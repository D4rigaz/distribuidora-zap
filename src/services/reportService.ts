import db from '../database/connection.js';

export class ReportService {
    /**
     * Retorna o faturamento total da distribuidora.
     */
    static async getTotalRevenue() {
        const result = await db('orders')
            .whereNot('status', 'Cancelado')
            .sum('total as total');
        return result[0]?.total || 0;
    }

    /**
     * Retorna os produtos mais vendidos.
     */
    static async getTopProducts(limit = 5) {
        // Como os itens estão em JSON, precisamos buscar e processar em memória
        // ou usar funções JSON do SQLite se disponíveis.
        const orders = await db('orders').whereNot('status', 'Cancelado').select('items');
        const sales: Record<string, { id: number, name: string, quantity: number, revenue: number }> = {};

        orders.forEach(order => {
            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            items.forEach((item: any) => {
                if (!sales[item.id]) {
                    sales[item.id] = { id: item.id, name: item.name, quantity: 0, revenue: 0 };
                }
                sales[item.id].quantity += item.quantity;
                sales[item.id].revenue += (item.quantity * item.price);
            });
        });

        return Object.values(sales)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, limit);
    }

    /**
     * Retorna o faturamento por cliente.
     */
    static async getRevenueByCustomer(limit = 10) {
        return db('orders')
            .join('customers', 'orders.customer_phone', 'customers.phone')
            .select('customers.name', 'orders.customer_phone')
            .sum('total as total_spent')
            .count('orders.id as total_orders')
            .whereNot('status', 'Cancelado')
            .groupBy('orders.customer_phone')
            .orderBy('total_spent', 'desc')
            .limit(limit);
    }

    /**
     * Retorna o status atual do estoque.
     */
    static async getStockStatus() {
        return db('products')
            .select('name', 'stock', 'category')
            .orderBy('stock', 'asc');
    }
}
