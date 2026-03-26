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
            console.log('Conexão fechada devido a erro. Tentando reconectar:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Conexão estabelecida com sucesso! O bot está online.');
        }
    });

    // Ouvinte de mensagens recebidas
    sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                if (!msg.key.fromMe && msg.message) {
                    const from = msg.key.remoteJid!;
                    const name = msg.pushName || 'Cliente';
                    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

                    console.log(`Mensagem recebida de ${name} (${from}): ${text}`);

                    const input = text.toLowerCase();

                    // Lógica do Menu (Issue #1)
                    if (input === 'oi' || input === 'ola' || input === 'olá') {
                        await sock.sendMessage(from, { 
                            text: `Olá, ${name}! Bem-vindo à Distribuidora Zap. 🍻\nDigite *MENU* para ver nossos produtos ou *PEDIDO* para ver o status do seu pedido.` 
                        });
                    } else if (input === 'menu') {
                        try {
                            // Buscar produtos com estoque agrupados por categoria
                            const products = await db('products')
                                .where('stock', '>', 0)
                                .orderBy('category', 'asc');

                            if (products.length === 0) {
                                await sock.sendMessage(from, { text: "No momento, estamos sem produtos em estoque. Tente novamente mais tarde! 😔" });
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
                        } catch (error) {
                            console.error("Erro ao buscar produtos:", error);
                            await sock.sendMessage(from, { text: "Opa, tivemos um problema ao carregar o menu. Tente novamente." });
                        }
                    }
                }
            }
        }
    });
}

// Inicia o processo
connectToWhatsApp().catch(err => console.log("Erro inesperado:", err));
