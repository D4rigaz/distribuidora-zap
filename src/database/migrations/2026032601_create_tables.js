/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Tabela de Clientes
  await knex.schema.createTable("customers", (table) => {
    table.string("phone").primary(); // Número do WhatsApp
    table.string("name");
    table.text("address");
    table.timestamp("last_interaction").defaultTo(knex.fn.now());
  });

  // Tabela de Produtos
  await knex.schema.createTable("products", (table) => {
    table.increments("id").primary();
    table.string("name").notNullable();
    table.decimal("price", 10, 2).notNullable();
    table.string("category").notNullable();
    table.integer("stock").defaultTo(0);
  });

  // Tabela de Pedidos
  await knex.schema.createTable("orders", (table) => {
    table.increments("id").primary();
    table.string("customer_phone").references("phone").inTable("customers");
    table.json("items").notNullable(); // Formato: [{product_id: 1, quantity: 2}]
    table.decimal("total", 10, 2).notNullable();
    table.string("status").defaultTo("Pendente");
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTable("orders");
  await knex.schema.dropTable("products");
  await knex.schema.dropTable("customers");
}
