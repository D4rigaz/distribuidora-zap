import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials-google.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export class GoogleSheetsService {
    private static auth: any;
    private static spreadsheetId: string = '';

    static async init(spreadsheetId: string) {
        if (!fs.existsSync(CREDENTIALS_PATH)) {
            console.error("❌ ERRO: Arquivo 'credentials-google.json' não encontrado na raiz do projeto.");
            return false;
        }
        this.spreadsheetId = spreadsheetId;
        this.auth = new google.auth.GoogleAuth({
            keyFile: CREDENTIALS_PATH,
            scopes: SCOPES,
        });
        return true;
    }

    static async appendOrder(orderId: number, session: any, customer: any, total: number) {
        if (!this.auth || !this.spreadsheetId) {
            console.warn("⚠️ Google Sheets Service não inicializado corretamente.");
            return;
        }

        const sheets = google.sheets({ version: 'v4', auth: this.auth });
        
        const timestamp = new Date().toLocaleString('pt-BR');
        const itemsSummary = session.cart.map((i: any) => `${i.quantity}x ${i.name}`).join(', ');
        
        const row = [
            orderId,
            timestamp,
            customer.name,
            customer.phone.split('@')[0],
            customer.address,
            itemsSummary,
            total.toFixed(2).replace('.', ','),
            'Pendente'
        ];

        try {
            // Tenta obter o nome da primeira aba da planilha
            const spreadsheet = await sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            const sheetName = spreadsheet.data.sheets?.[0]?.properties?.title || 'Página1';

            await sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:H`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [row]
                },
            });
            console.log(`✅ Pedido #${orderId} sincronizado com Google Sheets (${sheetName}).`);
        } catch (error) {
            console.error("❌ Erro ao sincronizar com Google Sheets:", error);
        }
    }

    // Método para criar uma nova planilha se necessário (usado para setup inicial)
    static async createSpreadsheet(title: string) {
        if (!fs.existsSync(CREDENTIALS_PATH)) return null;
        
        const auth = new google.auth.GoogleAuth({
            keyFile: CREDENTIALS_PATH,
            scopes: SCOPES,
        });
        const sheets = google.sheets({ version: 'v4', auth });

        try {
            const res = await sheets.spreadsheets.create({
                requestBody: {
                    properties: { title }
                }
            });
            const spreadsheetId = res.data.spreadsheetId;
            
            // Adicionar cabeçalhos
            await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId!,
                range: 'Sheet1!A1:H1',
                valueInputOption: 'RAW',
                requestBody: {
                    values: [['ID Pedido', 'Data/Hora', 'Cliente', 'Telefone', 'Endereço', 'Itens', 'Total', 'Status']]
                }
            });

            return spreadsheetId;
        } catch (error) {
            console.error("❌ Erro ao criar planilha:", error);
            return null;
        }
    }
}
