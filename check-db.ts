import db from './src/database/connection.js';

async function checkDb() {
    const products = await db('products').select('*');
    console.log("📦 *PRODUTOS:*", products.length);
    products.forEach(p => console.log(`[${p.id}] ${p.name} - R$ ${p.price} (Estoque: ${p.stock})`));

    const customers = await db('customers').select('*');
    console.log("\n👤 *CLIENTES:*", customers.length);
    customers.forEach(c => console.log(`${c.name} (${c.phone}) - ${c.address}`));

    const orders = await db('orders').select('*');
    console.log("\n🛒 *PEDIDOS:*", orders.length);
    orders.forEach(o => console.log(`ID: ${o.id}, Total: ${o.total}, Status: ${o.status}`));

    process.exit(0);
}

checkDb().catch(err => {
    console.error(err);
    process.exit(1);
});
