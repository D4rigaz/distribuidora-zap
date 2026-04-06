import db from '../database/connection.js';

export class OrderService {
    static async create(customerPhone: string, cart: any[], total: number) {
        return db.transaction(async (trx) => {
            // 1. Validar estoque de todos os itens primeiro
            for (const item of cart) {
                const product = await trx('products').where('id', item.id).first();
                if (!product || product.stock < item.quantity) {
                    throw new Error(`ESTOQUE_INSUFICIENTE:${item.name}:${product?.stock || 0}`);
                }
            }

            // 2. Salvar o pedido
            const [orderId] = await trx('orders').insert({
                customer_phone: customerPhone,
                items: JSON.stringify(cart),
                total: total,
                status: 'Pendente'
            });

            // 3. Atualizar o estoque
            for (const item of cart) {
                await trx('products')
                    .where('id', item.id)
                    .decrement('stock', item.quantity);
            }

            return orderId;
        });
    }

    static async getPending() {
        return db('orders')
            .where('status', 'Pendente')
            .join('customers', 'orders.customer_phone', 'customers.phone')
            .select('orders.*', 'customers.name as customer_name', 'customers.address');
    }

    static async updateStatus(orderId: number, status: string) {
        return db('orders').where('id', orderId).update({ status });
    }
}
