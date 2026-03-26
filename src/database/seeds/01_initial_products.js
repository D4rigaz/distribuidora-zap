/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
export async function seed(knex) {
  // Deleta entradas existentes
  await knex('products').del();
  
  // Insere bebidas iniciais
  await knex('products').insert([
    { name: 'Cerveja Skol 269ml', price: 2.50, category: 'Cervejas', stock: 100 },
    { name: 'Cerveja Brahma 350ml', price: 3.20, category: 'Cervejas', stock: 80 },
    { name: 'Cerveja Heineken 330ml', price: 6.50, category: 'Cervejas', stock: 50 },
    { name: 'Coca-Cola 2L', price: 9.50, category: 'Refrigerantes', stock: 30 },
    { name: 'Guaraná Antarctica 2L', price: 7.90, category: 'Refrigerantes', stock: 40 },
    { name: 'Água Mineral 500ml', price: 2.00, category: 'Águas', stock: 100 },
    { name: 'Red Bull 250ml', price: 8.50, category: 'Energéticos', stock: 60 },
    { name: 'Vinho Tinto Chileno 750ml', price: 35.00, category: 'Vinhos', stock: 20 },
  ]);
};
