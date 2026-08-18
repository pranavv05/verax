exports.up = async function up(knex) {
  await knex.schema.alterTable("waitlist", (table) => {
    table.string("firm_name", 255).nullable();
    table.string("contact_name", 255).nullable();
    table.string("phone", 20).nullable();
    table.string("status", 20).notNullable().defaultTo("new");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("waitlist", (table) => {
    table.dropColumn("firm_name");
    table.dropColumn("contact_name");
    table.dropColumn("phone");
    table.dropColumn("status");
  });
};
