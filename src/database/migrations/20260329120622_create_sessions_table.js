/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable("sessions", (table) => {
    table.string("phone").primary(); // Número do WhatsApp
    table.string("step").defaultTo("idle");
    table.integer("last_product_id").nullable();
    table.json("cart").notNullable().defaultTo("[]");
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTable("sessions");
}
