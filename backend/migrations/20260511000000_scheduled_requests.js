exports.up = async function up(knex) {
  await knex.schema.createTable("scheduled_requests", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("firm_id").notNullable().references("id").inTable("firms").onDelete("CASCADE");
    table.uuid("client_id").notNullable().references("id").inTable("clients").onDelete("CASCADE");
    table.specificType("document_types", "text[]").notNullable().defaultTo("{}");
    table.string("frequency", 10).notNullable();
    table.integer("day_of_month").nullable();
    table.integer("day_of_week").nullable();
    table.boolean("active").notNullable().defaultTo(true);
    table.timestamp("last_sent_at", { useTz: true }).nullable();
    table.uuid("created_by").nullable().references("id").inTable("users").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.check("frequency IN ('monthly', 'weekly')", [], "chk_scheduled_requests_frequency");
    table.check("day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 28)", [], "chk_scheduled_requests_day_of_month");
    table.check("day_of_week IS NULL OR (day_of_week BETWEEN 0 AND 6)", [], "chk_scheduled_requests_day_of_week");
  });

  await knex.raw(
    "CREATE UNIQUE INDEX uq_scheduled_requests_active_client ON scheduled_requests (firm_id, client_id) WHERE active = true;"
  );
  await knex.raw("CREATE INDEX idx_scheduled_requests_firm_active ON scheduled_requests (firm_id, active);");
  await knex.raw("CREATE INDEX idx_scheduled_requests_client ON scheduled_requests (client_id);");

  await knex.raw("ALTER TABLE scheduled_requests ENABLE ROW LEVEL SECURITY;");
  await knex.raw("ALTER TABLE scheduled_requests FORCE ROW LEVEL SECURITY;");
  await knex.raw(`
    CREATE POLICY scheduled_requests_isolation_policy
    ON scheduled_requests
    FOR ALL
    USING (
      firm_id = app.current_firm_id()
      OR current_setting('app.auth_context', true) = 'scheduler'
    )
    WITH CHECK (
      firm_id = app.current_firm_id()
      OR current_setting('app.auth_context', true) = 'scheduler'
    );
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP POLICY IF EXISTS scheduled_requests_isolation_policy ON scheduled_requests;");
  await knex.raw("DROP INDEX IF EXISTS idx_scheduled_requests_client;");
  await knex.raw("DROP INDEX IF EXISTS idx_scheduled_requests_firm_active;");
  await knex.raw("DROP INDEX IF EXISTS uq_scheduled_requests_active_client;");
  await knex.schema.dropTableIfExists("scheduled_requests");
};
