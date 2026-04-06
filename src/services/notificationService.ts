import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const WEBHOOK_URL = process.env.NOTIFICATION_WEBHOOK_URL;

export class NotificationService {
    static async sendOrderAlert(orderId: number, session: any, customer: any, total: number) {
        if (!WEBHOOK_URL) {
            console.warn("⚠️ NOTIFICATION_WEBHOOK_URL não configurado. Pulo de alerta de notificação.");
            return;
        }

        const itemsSummary = session.cart.map((i: any) => `• ${i.quantity}x ${i.name}`).join('\n');
        
        // Formata uma mensagem amigável para Slack ou Discord
        const message = {
            text: `🚀 *NOVO PEDIDO RECEBIDO (#${orderId})!* 🚀\n\n` +
                  `👤 *Cliente:* ${customer.name}\n` +
                  `📞 *WhatsApp:* ${customer.phone.split('@')[0]}\n` +
                  `📍 *Endereço:* ${customer.address}\n\n` +
                  `🛒 *Itens:*\n${itemsSummary}\n\n` +
                  `💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}`
        };

        try {
            await axios.post(WEBHOOK_URL, message);
            console.log(`✅ Alerta do pedido #${orderId} enviado para Slack/Discord.`);
        } catch (error: any) {
            console.error("❌ Erro ao enviar notificação para Slack/Discord:", error.response?.data || error.message);
        }
    }
}
