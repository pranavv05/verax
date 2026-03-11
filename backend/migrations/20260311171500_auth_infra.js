exports.up = async function up(knex) {
  await knex.schema.createTable("refresh_tokens", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("firm_id").notNullable().references("id").inTable("firms");
    table.uuid("user_id").notNullable().references("id").inTable("users");
    table.uuid("token_id").notNullable();
    table.string("token_hash", 128).notNullable();
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("revoked_at", { useTz: true }).nullable();
    table.uuid("replaced_by_token_id").nullable();
    table.text("user_agent").nullable();
    table.string("ip_address", 64).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("deleted_at", { useTz: true }).nullable();

    table.index(["firm_id"], "idx_refresh_tokens_firm_id");
    table.index(["user_id"], "idx_refresh_tokens_user_id");
    table.index(["firm_id", "user_id"], "idx_refresh_tokens_firm_user");
  });

  await knex.raw(`
    CREATE UNIQUE INDEX uq_refresh_tokens_token_id_active
    ON refresh_tokens (token_id)
    WHERE deleted_at IS NULL;
  `);

  await knex.raw(`
    CREATE INDEX idx_refresh_tokens_active_lookup
    ON refresh_tokens (firm_id, user_id, token_id, revoked_at, expires_at)
    WHERE deleted_at IS NULL;
  `);

  await knex.raw(`
    CREATE TRIGGER refresh_tokens_set_updated_at
    BEFORE UPDATE ON refresh_tokens
    FOR EACH ROW
    EXECUTE FUNCTION app.set_updated_at();
  `);

  await knex.raw("ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;");
  await knex.raw("ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;");

  await knex.raw(`
    CREATE POLICY refresh_tokens_isolation_policy
    ON refresh_tokens
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (firm_id = app.current_firm_id());
  `);

  await knex.raw("DROP POLICY IF EXISTS users_isolation_policy ON users;");
  await knex.raw(`
    CREATE POLICY users_isolation_policy
    ON users
    FOR ALL
    USING (
      firm_id = app.current_firm_id()
      OR (
        current_setting('app.auth_context', true) = 'login'
        AND lower(email) = lower(NULLIF(current_setting('app.auth_email', true), ''))
        AND deleted_at IS NULL
      )
    )
    WITH CHECK (firm_id = app.current_firm_id());
  `);

  await knex.raw("DROP POLICY IF EXISTS clients_isolation_policy ON clients;");
  await knex.raw(`
    CREATE POLICY clients_isolation_policy
    ON clients
    FOR ALL
    USING (
      firm_id = app.current_firm_id()
      OR (
        current_setting('app.auth_context', true) = 'magic_link'
        AND upload_token = NULLIF(current_setting('app.upload_token', true), '')
        AND deleted_at IS NULL
        AND (upload_token_expires_at IS NULL OR upload_token_expires_at > NOW())
      )
    )
    WITH CHECK (firm_id = app.current_firm_id());
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP POLICY IF EXISTS clients_isolation_policy ON clients;");
  await knex.raw(`
    CREATE POLICY clients_isolation_policy
    ON clients
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (firm_id = app.current_firm_id());
  `);

  await knex.raw("DROP POLICY IF EXISTS users_isolation_policy ON users;");
  await knex.raw(`
    CREATE POLICY users_isolation_policy
    ON users
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (firm_id = app.current_firm_id());
  `);

  await knex.raw("DROP POLICY IF EXISTS refresh_tokens_isolation_policy ON refresh_tokens;");
  await knex.raw("DROP TRIGGER IF EXISTS refresh_tokens_set_updated_at ON refresh_tokens;");

  await knex.schema.dropTableIfExists("refresh_tokens");
};
