import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

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
            qrcode.generate(qr, { small: true }); // Gera o QR Code manualmente
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
                    const from = msg.key.remoteJid;
                    const name = msg.pushName || 'Cliente';
                    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

                    console.log(`Mensagem recebida de ${name} (${from}): ${text}`);

                    // Lógica inicial simples de resposta
                    if (text.toLowerCase() === 'oi' || text.toLowerCase() === 'ola' || text.toLowerCase() === 'olá') {
                        await sock.sendMessage(from!, { 
                            text: `Olá, ${name}! Bem-vindo à Distribuidora Zap. 🍻\nDigite *MENU* para ver nossos produtos ou *PEDIDO* para ver o status do seu pedido.` 
                        });
                    }
                }
            }
        }
    });
}

// Inicia o processo
connectToWhatsApp().catch(err => console.log("Erro inesperado:", err));
