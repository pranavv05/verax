exports.up = async function up(knex) {
  await knex.schema.createTable("notifications", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("firm_id").notNullable().references("id").inTable("firms").onDelete("CASCADE");
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("type", 50).notNullable();
    table.string("title", 255).notNullable();
    table.text("message").notNullable();
    table.string("entity_type", 50).nullable();
    table.uuid("entity_id").nullable();
    table.boolean("read").notNullable().defaultTo(false);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    "CREATE INDEX idx_notifications_user_read_created ON notifications (user_id, read, created_at DESC);"
  );
  await knex.raw(
    "CREATE INDEX idx_notifications_firm_created ON notifications (firm_id, created_at DESC);"
  );

  await knex.raw("ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;");
  await knex.raw("ALTER TABLE notifications FORCE ROW LEVEL SECURITY;");
  await knex.raw(`
    CREATE POLICY notifications_isolation_policy
    ON notifications
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (firm_id = app.current_firm_id());
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP POLICY IF EXISTS notifications_isolation_policy ON notifications;");
  await knex.schema.dropTableIfExists("notifications");
};
