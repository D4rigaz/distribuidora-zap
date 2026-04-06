import { GoogleSheetsService } from './src/services/googleSheetsService.js';
import fs from 'fs';
import path from 'path';

async function setup() {
    console.log("🚀 Iniciando setup do Google Sheets...");
    
    const spreadsheetId = await GoogleSheetsService.createSpreadsheet("Distribuidora Zap - Pedidos");
    
    if (spreadsheetId) {
        console.log(`✅ Planilha criada com sucesso!`);
        console.log(`🆔 ID da Planilha: ${spreadsheetId}`);
        console.log(`🔗 Link: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
        
        const envContent = `SPREADSHEET_ID=${spreadsheetId}\nADMIN_PHONE=5561900000000@s.whatsapp.net\n`;
        fs.writeFileSync(path.join(process.cwd(), '.env'), envContent);
        console.log("📝 Arquivo .env criado/atualizado com o SPREADSHEET_ID.");
        
        console.log("\n⚠️ IMPORTANTE: Certifique-se de que as APIs estão ativadas no Google Cloud Console.");
    } else {
        console.error("❌ Falha ao criar a planilha. Verifique se o arquivo 'credentials-google.json' está correto e se a API do Google Sheets está ativada.");
    }
}

setup();
