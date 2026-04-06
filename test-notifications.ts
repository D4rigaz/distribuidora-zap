import { NotificationService } from './src/services/notificationService.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testNotification() {
    console.log("🚀 Iniciando teste de notificação Slack/Discord...");
    
    if (!process.env.NOTIFICATION_WEBHOOK_URL) {
        console.error("❌ Erro: NOTIFICATION_WEBHOOK_URL não definida no arquivo .env");
        return;
    }

    const mockOrder = {
        id: 777,
        total: 89.90,
        customer: {
            name: "João das Neves",
            phone: "5561888888888@s.whatsapp.net",
            address: "Muralha de Gelo, s/n, Norte"
        },
        session: {
            cart: [
                { quantity: 3, name: "Vinho Tinto Seco" },
                { quantity: 1, name: "Carvão 4kg" }
            ]
        }
    };

    console.log("📡 Enviando alerta de teste...");
    await NotificationService.sendOrderAlert(
        mockOrder.id,
        mockOrder.session,
        mockOrder.customer,
        mockOrder.total
    );
    
    console.log("\n🏁 Teste finalizado. Verifique seu canal no Slack ou Discord!");
}

testNotification();
