exports.up = async function up(knex) {
  await knex.schema.createTable("password_reset_tokens", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("firm_id").notNullable().references("id").inTable("firms");
    table.uuid("user_id").notNullable().references("id").inTable("users");
    table.string("token_hash", 128).notNullable();
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("used_at", { useTz: true }).nullable();
    table.text("user_agent").nullable();
    table.string("ip_address", 64).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("deleted_at", { useTz: true }).nullable();

    table.index(["firm_id"], "idx_password_reset_tokens_firm_id");
    table.index(["user_id"], "idx_password_reset_tokens_user_id");
    table.index(["token_hash"], "idx_password_reset_tokens_token_hash");
  });

  await knex.raw(`
    CREATE UNIQUE INDEX uq_password_reset_tokens_hash_active
    ON password_reset_tokens (token_hash)
    WHERE deleted_at IS NULL;
  `);

  await knex.raw(`
    CREATE TRIGGER password_reset_tokens_set_updated_at
    BEFORE UPDATE ON password_reset_tokens
    FOR EACH ROW
    EXECUTE FUNCTION app.set_updated_at();
  `);

  await knex.raw("ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;");
  await knex.raw("ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;");

  await knex.raw(`
    CREATE POLICY password_reset_tokens_isolation_policy
    ON password_reset_tokens
    FOR ALL
    USING (
      firm_id = app.current_firm_id()
      OR (
        current_setting('app.auth_context', true) = 'password_reset'
        AND token_hash = NULLIF(current_setting('app.password_reset_token_hash', true), '')
        AND deleted_at IS NULL
      )
    )
    WITH CHECK (firm_id = app.current_firm_id());
  `);
};

exports.down = async function down(knex) {
  await knex.raw(
    "DROP POLICY IF EXISTS password_reset_tokens_isolation_policy ON password_reset_tokens;"
  );
  await knex.raw(
    "DROP TRIGGER IF EXISTS password_reset_tokens_set_updated_at ON password_reset_tokens;"
  );
  await knex.schema.dropTableIfExists("password_reset_tokens");
};
