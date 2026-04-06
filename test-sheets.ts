import { GoogleSheetsService } from './src/services/googleSheetsService.js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function testSync() {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    
    console.log(`🚀 Iniciando teste de sincronização para a planilha: ${spreadsheetId}`);
    
    const initialized = await GoogleSheetsService.init(spreadsheetId!);
    if (!initialized) {
        console.error("❌ Falha ao inicializar GoogleSheetsService.");
        return;
    }

    const mockOrder = {
        id: 999,
        total: 150.50,
        customer: {
            name: "Cliente Teste Gemini",
            phone: "5561999999999@s.whatsapp.net",
            address: "Rua de Teste, 123, Bairro Tech"
        },
        session: {
            cart: [
                { quantity: 2, name: "Cerveja Eisenbahn 600ml" },
                { quantity: 1, name: "Gelo 5kg" }
            ]
        }
    };

    console.log("📝 Enviando pedido de teste...");
    await GoogleSheetsService.appendOrder(
        mockOrder.id,
        mockOrder.session,
        mockOrder.customer,
        mockOrder.total
    );
    
    console.log("\n🏁 Teste finalizado. Verifique sua planilha no navegador!");
}

testSync();
