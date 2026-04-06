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
import { SessionService } from './services/sessionService.js';
import { GoogleSheetsService } from './services/googleSheetsService.js';

dotenv.config();

const ADMIN_PHONE = (process.env.ADMIN_PHONE || '').replace(/\s/g, '');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '';

if (SPREADSHEET_ID) GoogleSheetsService.init(SPREADSHEET_ID);

const logger = pino({ level: 'error' });

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    console.log(`[SISTEMA] Iniciando Baileys v${version.join('.')}...`);

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
        if (qr) {
            console.log('\n[SISTEMA] --- NOVO QR CODE GERADO ---');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log(`[SISTEMA] Conexão encerrada (${reason}). Reiniciando...`);
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if (connection === 'open') {
            console.log('\n✅ BOT ONLINE E ESTABILIZADO!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
            try {
                if (msg.key.fromMe) continue;
                
                const remoteJid = msg.key.remoteJid!;
                if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@newsletter')) continue;

                const from = jidNormalizedUser(remoteJid.replace(/\s/g, ''));
                const name = msg.pushName || 'Cliente';
                const text = msg.message?.conversation || 
                             msg.message?.extendedTextMessage?.text || 
                             '';

                if (!text) continue;
                const input = text.trim().toLowerCase();

                console.log(`[MSG] ${name} (${from}): ${text}`);

                const session = await SessionService.getOrCreate(from);
                await CustomerService.sync(from, name);

                // --- COMANDOS GLOBAIS ---
                if (input === '0' || input === 'voltar' || input === 'cancelar') {
                    session.step = 'idle';
                    delete session.lastProductId;
                    await sock.sendMessage(from, { text: "🔄 Ação cancelada. Digite *MENU* para ver os produtos novamente." });
                    await SessionService.save(session);
                    continue;
                }

                // --- LÓGICA DE ATENDIMENTO REFINADA ---

                // 1. MENU VISUAL
                if (['oi', 'menu', 'olá', 'ola', 'inicio', 'início'].includes(input)) {
                    session.step = 'idle';
                    const products = await ProductService.getAvailableProducts();
                    
                    let menuMsg = `🍻 *DISTRIBUIDORA ZAP* 🍻\n`;
                    menuMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
                    menuMsg += `Olá, *${name}*! Como posso te ajudar hoje?\n\n`;
                    menuMsg += `*NOSSO CARDÁPIO:*\n`;
                    
                    products.forEach(p => {
                        menuMsg += `\n*[${p.id}]* ${p.name}\n💰 _R$ ${p.price.toFixed(2).replace('.', ',')}_\n`;
                    });

                    menuMsg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
                    menuMsg += `👉 Digite o *NÚMERO* do produto para pedir.\n`;
                    menuMsg += `🛒 Digite *CARRINHO* para ver seu pedido.\n`;
                    menuMsg += `🏁 Digite *FINALIZAR* para fechar o pedido.`;
                    
                    await sock.sendMessage(from, { text: menuMsg });
                } 
                
                // 2. CARRINHO DETALHADO
                else if (input === 'carrinho') {
                    if (session.cart.length === 0) {
                        await sock.sendMessage(from, { text: "🛍️ *Seu carrinho está vazio!*\n\nDigite *MENU* para ver nossas bebidas geladinhas." });
                    } else {
                        let res = "🛒 *RESUMO DO SEU PEDIDO:*\n";
                        res += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                        let total = 0;
                        session.cart.forEach(i => {
                            const subtotal = i.price * i.quantity;
                            res += `✅ *${i.quantity}x* ${i.name}\n   _R$ ${subtotal.toFixed(2).replace('.', ',')}_\n\n`;
                            total += subtotal;
                        });
                        res += `━━━━━━━━━━━━━━━━━━━━\n`;
                        res += `💰 *TOTAL: R$ ${total.toFixed(2).replace('.', ',')}*\n\n`;
                        res += `🏁 Digite *FINALIZAR* para concluir.\n`;
                        res += `➕ Digite *MENU* para adicionar mais.\n`;
                        res += `↩️ Digite *0* para cancelar tudo.`;
                        await sock.sendMessage(from, { text: res });
                    }
                }

                // 3. FINALIZAR COM VALIDAÇÃO
                else if (input === 'finalizar') {
                    if (session.cart.length === 0) {
                        await sock.sendMessage(from, { text: "⚠️ *Ops!* Você ainda não adicionou nada.\n\nDigite *MENU* para começar a comprar." });
                    } else {
                        const cust = await CustomerService.getByPhone(from);
                        if (!cust?.address) {
                            session.step = 'awaiting_address';
                            await sock.sendMessage(from, { text: "📍 *PRECISAMOS DO SEU ENDEREÇO*\n\nPor favor, envie sua *Rua, Número e Bairro* para a entrega:" });
                        } else {
                            session.step = 'awaiting_confirmation';
                            let confirmMsg = `📝 *CONFIRMAÇÃO DO PEDIDO*\n\n`;
                            confirmMsg += `📍 *Entrega:* ${cust.address}\n`;
                            confirmMsg += `💰 *Total:* R$ ${session.cart.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(2).replace('.', ',')}\n\n`;
                            confirmMsg += `Podemos confirmar? Digite *SIM* ou *0* para cancelar.`;
                            await sock.sendMessage(from, { text: confirmMsg });
                        }
                    }
                }

                // 4. SELEÇÃO DE PRODUTO
                else if (session.step === 'idle' && /^\d+$/.test(input)) {
                    const productId = parseInt(input);
                    const product = await ProductService.getById(productId);
                    
                    if (product) {
                        if (product.stock <= 0) {
                            await sock.sendMessage(from, { text: `😔 Desculpe, o produto *${product.name}* está esgotado no momento.` });
                        } else {
                            session.step = 'awaiting_quantity';
                            session.lastProductId = product.id;
                            await sock.sendMessage(from, { text: `🍺 *${product.name}*\n\nQuantas unidades você deseja?\n_(Digite um número ou *0* para voltar)_` });
                        }
                    } else {
                        await sock.sendMessage(from, { text: "❌ *Código inválido.* Por favor, verifique o número no *MENU*." });
                    }
                }

                // 5. DEFINIR QUANTIDADE
                else if (session.step === 'awaiting_quantity' && /^\d+$/.test(input)) {
                    const qty = parseInt(input);
                    if (qty <= 0) {
                        await sock.sendMessage(from, { text: "⚠️ A quantidade deve ser maior que zero." });
                        continue;
                    }

                    const product = await ProductService.getById(session.lastProductId!);
                    if (product) {
                        const existing = session.cart.findIndex(i => i.id === product.id);
                        if (existing > -1) session.cart[existing]!.quantity += qty;
                        else session.cart.push({ id: product.id, name: product.name, price: product.price, quantity: qty });
                        
                        session.step = 'idle';
                        delete session.lastProductId;
                        
                        let successMsg = `✅ *${qty}x ${product.name}* adicionado(s)!\n\n`;
                        successMsg += `🛒 Digite *CARRINHO* para ver seu pedido.\n`;
                        successMsg += `🛍️ Digite *MENU* para continuar comprando.`;
                        await sock.sendMessage(from, { text: successMsg });
                    }
                }

                // 6. ENDEREÇO
                else if (session.step === 'awaiting_address') {
                    if (text.length < 10) {
                        await sock.sendMessage(from, { text: "⚠️ Endereço muito curto. Por favor, detalhe melhor (Rua, Número, Bairro)." });
                    } else {
                        await CustomerService.updateAddress(from, text.trim());
                        session.step = 'idle';
                        await sock.sendMessage(from, { text: "📍 *Endereço salvo com sucesso!*\n\nAgora você pode digitar *FINALIZAR* para concluir seu pedido." });
                    }
                }

                // 7. CONFIRMAÇÃO FINAL
                else if (session.step === 'awaiting_confirmation' && (input === 'sim' || input === 's')) {
                    const total = session.cart.reduce((s, i) => s + (i.price * i.quantity), 0);
                    const orderId = await OrderService.create(from, session.cart, total);
                    
                    await sock.sendMessage(from, { text: `🥳 *PARABÉNS! SEU PEDIDO #${orderId} FOI REALIZADO!*\n\nNossa equipe já está preparando sua entrega. Em breve chegamos aí! 🛵💨` });
                    
                    if (ADMIN_PHONE) {
                        let adminMsg = `🚀 *NOVO PEDIDO RECEBIDO (#${orderId})*\n\n`;
                        adminMsg += `👤 *Cliente:* ${name}\n`;
                        adminMsg += `💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}\n`;
                        adminMsg += `📍 *Endereço:* ${(await CustomerService.getByPhone(from))?.address}`;
                        await sock.sendMessage(ADMIN_PHONE, { text: adminMsg });
                    }
                    
                    session.cart = [];
                    session.step = 'idle';
                }

                await SessionService.save(session);
            } catch (err) {
                console.error("❌ Erro:", err);
            }
        }
    });
}

connectToWhatsApp().catch(err => console.log(err));
