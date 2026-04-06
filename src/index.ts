import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    jidNormalizedUser
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import * as dotenv from 'dotenv';
import { ProductService } from './services/productService.js';
import { CustomerService } from './services/customerService.js';
import { OrderService } from './services/orderService.js';
import { SessionService, Session } from './services/sessionService.js';
import { GoogleSheetsService } from './services/googleSheetsService.js';
import { NotificationService } from './services/notificationService.js';

dotenv.config();

const ADMIN_PHONE = process.env.ADMIN_PHONE || '5561900000000@s.whatsapp.net';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '';

if (SPREADSHEET_ID) {
    GoogleSheetsService.init(SPREADSHEET_ID);
}

const logger = pino({ level: 'silent' });

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    console.log(`Iniciando bot v${version.join('.')}...`);

    const sock = makeWASocket({
        version,
        auth: state,
        logger,
        browser: ['Distribuidora Zap', 'Chrome', '1.0.0'],
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ Bot Conectado e Online!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
            try {
                if (msg.key.fromMe) continue;
                const remoteJid = msg.key.remoteJid!;
                if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@newsletter')) continue;

                // Normalização inteligente para suportar LIDs (88...) e JIDs (55...)
                const from = jidNormalizedUser(remoteJid);
                
                const name = msg.pushName || 'Cliente';
                const text = msg.message?.conversation || 
                             msg.message?.extendedTextMessage?.text || 
                             '';

                if (!text) continue;
                const input = text.trim().toLowerCase();
                console.log(`📩 [${from}] ${name}: ${text}`);

                const session = await SessionService.getOrCreate(from);
                await CustomerService.sync(from, name);

                // FLUXO DO CLIENTE
                if (['oi', 'menu', 'olá', 'ola', 'início', 'inicio'].includes(input)) {
                    console.log(`🤖 Respondendo MENU para ${from}`);
                    session.step = 'idle';
                    const products = await ProductService.getAvailableProducts();
                    let menu = `Olá ${name}, seja bem-vindo! 🍻\n\n*CARDÁPIO*\n`;
                    products.forEach(p => menu += `[${p.id}] ${p.name} - R$ ${p.price.toFixed(2).replace('.', ',')}\n`);
                    menu += "\nDigite o *código* do produto para pedir.";
                    await sock.sendMessage(from, { text: menu });
                } 
                else if (input === 'carrinho') {
                    if (session.cart.length === 0) return await sock.sendMessage(from, { text: "Seu carrinho está vazio!" });
                    let res = "🛒 *SEU CARRINHO*\n\n";
                    let total = 0;
                    session.cart.forEach(i => {
                        res += `${i.quantity}x ${i.name} - R$ ${(i.price * i.quantity).toFixed(2)}\n`;
                        total += i.price * i.quantity;
                    });
                    res += `\n*TOTAL: R$ ${total.toFixed(2)}*\n\nDigite *FINALIZAR* para fechar.`;
                    await sock.sendMessage(from, { text: res });
                }
                else if (input === 'finalizar') {
                    const cust = await CustomerService.getByPhone(from);
                    if (!cust?.address) {
                        session.step = 'awaiting_address';
                        await sock.sendMessage(from, { text: "📍 Por favor, digite seu endereço completo de entrega:" });
                    } else {
                        session.step = 'awaiting_confirmation';
                        await sock.sendMessage(from, { text: `Confirmar pedido para entrega em:\n*${cust.address}*?\n\nDigite *SIM* ou *NÃO*.` });
                    }
                }
                else if (session.step === 'idle' && /^\d+$/.test(input)) {
                    const product = await ProductService.getById(parseInt(input));
                    if (product) {
                        session.step = 'awaiting_quantity';
                        session.lastProductId = product.id;
                        await sock.sendMessage(from, { text: `Quantas unidades de *${product.name}* você deseja?` });
                    }
                }
                else if (session.step === 'awaiting_quantity' && /^\d+$/.test(input)) {
                    const qty = parseInt(input);
                    const product = await ProductService.getById(session.lastProductId!);
                    if (product && qty > 0) {
                        session.cart.push({ id: product.id, name: product.name, price: product.price, quantity: qty });
                        session.step = 'idle';
                        await sock.sendMessage(from, { text: `✅ Adicionado! Digite *CARRINHO* para ver ou envie o código de outro produto.` });
                    }
                }
                else if (session.step === 'awaiting_address') {
                    await CustomerService.updateAddress(from, text);
                    session.step = 'idle';
                    await sock.sendMessage(from, { text: "📍 Endereço salvo com sucesso! Digite *FINALIZAR* para concluir o pedido." });
                }
                else if (session.step === 'awaiting_confirmation' && (input === 'sim' || input === 's')) {
                    const total = session.cart.reduce((s, i) => s + (i.price * i.quantity), 0);
                    const orderId = await OrderService.create(from, session.cart, total);
                    await sock.sendMessage(from, { text: `✅ Pedido #${orderId} realizado com sucesso! 🍻` });
                    await sock.sendMessage(ADMIN_PHONE, { text: `🚀 *NOVO PEDIDO #${orderId}* de ${name}!\nTotal: R$ ${total.toFixed(2)}` });
                    session.cart = [];
                    session.step = 'idle';
                }

                await SessionService.save(session);
            } catch (err) {
                console.error("❌ Erro ao processar mensagem:", err);
            }
        }
    });
}

connectToWhatsApp().catch(err => console.log(err));
