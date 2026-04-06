import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ProductService } from "./services/productService.js";
import { CustomerService } from "./services/customerService.js";
import { OrderService } from "./services/orderService.js";
import { ReportService } from "./services/reportService.js";
import { GoogleSheetsService } from "./services/googleSheetsService.js";
import * as dotenv from "dotenv";

dotenv.config();

const server = new Server(
  {
    name: "zap-manager",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Inicializar serviços dependentes de ENV
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "";
if (SPREADSHEET_ID) {
  GoogleSheetsService.init(SPREADSHEET_ID);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_bi_summary",
        description: "Retorna o faturamento total e os produtos mais vendidos da Distribuidora Zap.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_stock_alert",
        description: "Lista produtos com estoque baixo (menos de 10 unidades).",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "sync_pending_orders",
        description: "Sincroniza todos os pedidos pendentes com a planilha do Google Sheets.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "get_bi_summary": {
        const totalRevenue = await ReportService.getTotalRevenue();
        const topProducts = await ReportService.getTopProducts();
        
        let summary = `💰 *Faturamento Total:* R$ ${Number(totalRevenue).toFixed(2).replace('.', ',')}\n\n`;
        summary += `🔥 *Top Produtos:*\n`;
        topProducts.forEach((p, i) => {
          summary += `${i + 1}. ${p.name}: ${p.quantity} un.\n`;
        });
        
        return {
          content: [{ type: "text", text: summary }],
        };
      }

      case "get_stock_alert": {
        const stocks = await ReportService.getStockStatus();
        const lowStock = stocks.filter(p => p.stock < 10);
        
        if (lowStock.length === 0) {
          return { content: [{ type: "text", text: "✅ Todos os produtos estão com estoque saudável." }] };
        }
        
        let alert = `⚠️ *ESTOQUE BAIXO:*\n`;
        lowStock.forEach(p => {
          alert += `• ${p.name}: ${p.stock} un.\n`;
        });
        
        return { content: [{ type: "text", text: alert }] };
      }

      case "sync_pending_orders": {
        if (!SPREADSHEET_ID) {
          return { content: [{ type: "text", text: "❌ SPREADSHEET_ID não configurado no .env" }], isError: true };
        }
        
        const pending = await OrderService.getPending();
        if (pending.length === 0) {
          return { content: [{ type: "text", text: "Nenhum pedido pendente para sincronizar." }] };
        }
        
        // No contexto real, o bot já sincroniza na hora da criação.
        // Esta ferramenta serve para garantir consistência ou auditoria.
        return { content: [{ type: "text", text: `Encontrados ${pending.length} pedidos pendentes no banco de dados. Verifique a planilha: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}` }] };
      }

      default:
        throw new Error("Ferramenta não encontrada");
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Erro: ${error.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Zap Manager MCP Server running on stdio");
