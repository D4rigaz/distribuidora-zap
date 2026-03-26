import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import db from './database/connection.js';

// Configuração do logger para evitar poluição visual
const logger = pino({ level: 'silent' });

// --- GESTÃO DE SESSÃO (MOCK DE REDIS) ---
interface CartItem {
    id: number;
    name: string;
    price: number;
    quantity: number;
}

interface Session {
    step: 'idle' | 'awaiting_quantity' | 'awaiting_name' | 'awaiting_address' | 'confirming_address';
    lastProductId?: number;
    cart: CartItem[];
    tempName?: string;
    tempAddress?: string;
}

const sessions: Record<string, Session> = {};

function getSession(from: string): Session {
    if (!sessions[from]) {
        sessions[from] = { step: 'idle', cart: [] };
    }
    return sessions[from]!;
}
// ----------------------------------------

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`Usando WhatsApp Web v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        auth: state,
        logger,
        browser: ['Distribuidora Zap', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('Escaneie o QR Code abaixo com seu WhatsApp:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('Conexão estabelecida com sucesso! O bot está online.');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                if (!msg.key.fromMe && msg.message) {
                    const from = msg.key.remoteJid!;
                    const name = msg.pushName || 'Cliente';
                    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                    const input = text.trim().toLowerCase();
                    const session = getSession(from);

                    console.log(`[${from}] ${name}: ${text}`);

                    // 1. GATILHOS GLOBAIS
                    if (['oi', 'olá', 'ola', 'menu', 'inicio'].includes(input)) {
                        session.step = 'idle';
                        if (input === 'menu') {
                            const products = await db('products').where('stock', '>', 0).orderBy('category', 'asc');
                            if (products.length === 0) {
                                await sock.sendMessage(from, { text: "No momento, estamos sem estoque. 😔" });
                                return;
                            }
                            let menuMessage = "🍻 *NOSSO CARDÁPIO* 🍻\n\n";
                            let currentCategory = "";
                            products.forEach((prod) => {
                                if (prod.category !== currentCategory) {
                                    currentCategory = prod.category;
                                    menuMessage += `\n--- *${currentCategory.toUpperCase()}* ---\n`;
                                }
                                menuMessage += `[${prod.id}] ${prod.name} - R$ ${prod.price.toFixed(2).replace('.', ',')}\n`;
                            });
                            menuMessage += "\n\nPara pedir, digite o *código* do produto (ex: *1*).";
                            await sock.sendMessage(from, { text: menuMessage });
                        } else {
                            await sock.sendMessage(from, { 
                                text: `Olá, ${name}! Bem-vindo à Distribuidora Zap. 🍻\n\nDigite *MENU* para ver produtos.\nDigite *CARRINHO* para ver seu pedido.` 
                            });
                        }
                        return;
                    }

                    if (input === 'carrinho') {
                        if (session.cart.length === 0) {
                            await sock.sendMessage(from, { text: "Seu carrinho está vazio! Digite *MENU* para escolher algo." });
                            return;
                        }
                        let cartMsg = "🛒 *SEU CARRINHO* 🛒\n\n";
                        let total = 0;
                        session.cart.forEach(item => {
                            const subtotal = item.price * item.quantity;
                            total += subtotal;
                            cartMsg += `• ${item.quantity}x ${item.name} - R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
                        });
                        cartMsg += `\n*TOTAL: R$ ${total.toFixed(2).replace('.', ',')}*`;
                        cartMsg += "\n\nDigite *MENU* para adicionar mais ou *FINALIZAR* para fechar o pedido.";
                        await sock.sendMessage(from, { text: cartMsg });
                        return;
                    }

                    if (input === 'finalizar') {
                        if (session.cart.length === 0) {
                            await sock.sendMessage(from, { text: "Seu carrinho está vazio! Digite *MENU* para escolher algo." });
                            return;
                        }

                        // Verificar se o cliente já existe
                        const customer = await db('customers').where({ phone: from }).first();

                        if (!customer) {
                            session.step = 'awaiting_name';
                            await sock.sendMessage(from, { text: "Vi que é sua primeira vez por aqui! 😊\n\nQual o seu *nome completo*?" });
                        } else {
                            session.step = 'confirming_address';
                            session.tempName = customer.name;
                            session.tempAddress = customer.address;
                            await sock.sendMessage(from, { 
                                text: `Confirmamos seu cadastro, *${customer.name}*!\n\nDeseja entregar no endereço abaixo?\n📍 ${customer.address}\n\nResponda com *SIM* para confirmar ou digite o *NOVO ENDEREÇO* de entrega.` 
                            });
                        }
                        return;
                    }

                    // 2. LOGICA DE ESTADO
                    if (session.step === 'idle' && /^\d+$/.test(input)) {
                        const productId = parseInt(input);
                        const product = await db('products').where({ id: productId }).first();
                        
                        if (!product || product.stock <= 0) {
                            await sock.sendMessage(from, { text: "Opa! Código inválido ou produto sem estoque. Digite *MENU* para ver as opções." });
                            return;
                        }

                        session.step = 'awaiting_quantity';
                        session.lastProductId = product.id;
                        await sock.sendMessage(from, { text: `Quantas unidades de *${product.name}* você deseja?` });
                    } 
                    else if (session.step === 'awaiting_quantity' && /^\d+$/.test(input)) {
                        const quantity = parseInt(input);
                        if (quantity <= 0) {
                            await sock.sendMessage(from, { text: "Por favor, digite uma quantidade válida (maior que 0)." });
                            return;
                        }

                        const product = await db('products').where({ id: session.lastProductId }).first();
                        if (product) {
                            const existingIndex = session.cart.findIndex(i => i.id === product.id);
                            if (existingIndex > -1) {
                                session.cart[existingIndex]!.quantity += quantity;
                            } else {
                                session.cart.push({
                                    id: product.id,
                                    name: product.name,
                                    price: product.price,
                                    quantity: quantity
                                });
                            }
                            await sock.sendMessage(from, { text: `✅ Adicionado: ${quantity}x ${product.name}.\n\nDigite *MENU* para continuar comprando ou *CARRINHO* para ver seu pedido.` });
                        }
                        session.step = 'idle';
                        delete session.lastProductId;
                    }
                    else if (session.step === 'awaiting_name') {
                        session.tempName = text;
                        session.step = 'awaiting_address';
                        await sock.sendMessage(from, { text: `Prazer, ${text}! Agora, qual o *endereço completo* para a entrega? (Rua, número, bairro e complemento)` });
                    }
                    else if (session.step === 'awaiting_address' || (session.step === 'confirming_address' && input !== 'sim')) {
                        const address = text;
                        const finalName = session.tempName!;
                        
                        // Upsert customer
                        const customer = await db('customers').where({ phone: from }).first();
                        if (customer) {
                            await db('customers').where({ phone: from }).update({ name: finalName, address: address, last_interaction: db.fn.now() });
                        } else {
                            await db('customers').insert({ phone: from, name: finalName, address: address });
                        }

                        // Criar Pedido
                        const total = session.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                        const [orderId] = await db('orders').insert({
                            customer_phone: from,
                            items: JSON.stringify(session.cart),
                            total: total,
                            status: 'Pendente'
                        });

                        await sock.sendMessage(from, { 
                            text: `🚀 *PEDIDO RECEBIDO COM SUCESSO!* 🚀\n\n*Número do Pedido:* #${orderId}\n*Cliente:* ${finalName}\n*Endereço:* ${address}\n*Total:* R$ ${total.toFixed(2).replace('.', ',')}\n\nEm breve você receberá atualizações sobre a entrega! 🍻` 
                        });

                        // Limpar Sessão
                        session.step = 'idle';
                        session.cart = [];
                        delete session.tempName;
                        delete session.tempAddress;
                    }
                    else if (session.step === 'confirming_address' && input === 'sim') {
                        const finalName = session.tempName!;
                        const address = session.tempAddress!;

                        // Criar Pedido
                        const total = session.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                        const [orderId] = await db('orders').insert({
                            customer_phone: from,
                            items: JSON.stringify(session.cart),
                            total: total,
                            status: 'Pendente'
                        });

                        await sock.sendMessage(from, { 
                            text: `🚀 *PEDIDO RECEBIDO COM SUCESSO!* 🚀\n\n*Número do Pedido:* #${orderId}\n*Cliente:* ${finalName}\n*Endereço:* ${address}\n*Total:* R$ ${total.toFixed(2).replace('.', ',')}\n\nEm breve você receberá atualizações sobre a entrega! 🍻` 
                        });

                        // Limpar Sessão
                        session.step = 'idle';
                        session.cart = [];
                        delete session.tempName;
                        delete session.tempAddress;
                    }
                }
            }
        }
    });
}

connectToWhatsApp().catch(err => console.log("Erro inesperado:", err));
