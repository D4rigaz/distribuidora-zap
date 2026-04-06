import { ReportService } from './src/services/reportService.js';

async function generateReport() {
    console.log("📊 *RELATÓRIO DE BUSINESS INTELLIGENCE - DISTRIBUIDORA ZAP* 📊\n");

    const totalRevenue = await ReportService.getTotalRevenue();
    console.log(`💰 *Faturamento Total:* R$ ${Number(totalRevenue).toFixed(2).replace('.', ',')}`);

    const topProducts = await ReportService.getTopProducts();
    console.log("\n🔥 *Top 5 Produtos Mais Vendidos:*");
    topProducts.forEach((p, i) => {
        console.log(`${i + 1}. ${p.name} - ${p.quantity} un. (R$ ${p.revenue.toFixed(2).replace('.', ',')})`);
    });

    const topCustomers = await ReportService.getRevenueByCustomer(5);
    console.log("\n👑 *Melhores Clientes:*");
    topCustomers.forEach((c, i) => {
        console.log(`${i + 1}. ${c.name || c.customer_phone} - ${c.total_orders} pedidos - Total R$ ${Number(c.total_spent).toFixed(2).replace('.', ',')}`);
    });

    const lowStock = (await ReportService.getStockStatus()).filter(p => p.stock < 10);
    if (lowStock.length > 0) {
        console.log("\n⚠️ *Alerte de Estoque Baixo:*");
        lowStock.forEach(p => {
            console.log(`• ${p.name}: ${p.stock} un. restantes`);
        });
    }

    process.exit(0);
}

generateReport().catch(err => {
    console.error("Erro ao gerar relatório:", err);
    process.exit(1);
});
