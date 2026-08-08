/**
 * Client portal authentication.
 *
 * Adds a second, completely separate auth world for SME clients of a CA firm:
 * portal credentials live on `clients`, and client sessions are tracked in
 * `client_refresh_tokens` (mirroring the firm-side `refresh_tokens` table).
 *
 * RLS notes:
 *  - `client_refresh_tokens` is scoped by `app.current_client_id` (set by
 *    `requireClientAuth`), the client-portal analogue of `app.current_firm_id`.
 *  - `clients_isolation_policy` gains a third branch: an unauthenticated
 *    client-portal login needs to look its own row up by `portal_email` before
 *    any firm context exists. This mirrors the existing `login` escape hatch on
 *    `users` and the `magic_link` branch already on `clients`.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable("clients", (table) => {
    table.string("portal_email", 255).nullable();
    table.string("portal_password_hash", 255).nullable();
    table.boolean("portal_enabled").notNullable().defaultTo(false);
    table.timestamp("portal_last_login_at", { useTz: true }).nullable();
  });

  // Case-insensitive uniqueness among live clients only, matching the
  // uq_users_email_active pattern (soft-deleted rows must not block reuse).
  await knex.raw(`
    CREATE UNIQUE INDEX uq_clients_portal_email_active
    ON clients (lower(portal_email))
    WHERE portal_email IS NOT NULL AND deleted_at IS NULL;
  `);

  await knex.raw(`
    CREATE INDEX idx_clients_portal_enabled
    ON clients (firm_id, portal_enabled)
    WHERE deleted_at IS NULL;
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION app.current_client_id()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('app.current_client_id', true), '')::uuid;
    $$;
  `);

  await knex.schema.createTable("client_refresh_tokens", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("client_id")
      .notNullable()
      .references("id")
      .inTable("clients")
      .onDelete("CASCADE");
    table.string("token_hash", 255).notNullable();
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("revoked_at", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(["client_id"], "idx_client_refresh_tokens_client_id");
  });

  await knex.raw(`
    CREATE INDEX idx_client_refresh_tokens_active_lookup
    ON client_refresh_tokens (client_id, revoked_at, expires_at);
  `);

  await knex.raw("ALTER TABLE client_refresh_tokens ENABLE ROW LEVEL SECURITY;");
  await knex.raw("ALTER TABLE client_refresh_tokens FORCE ROW LEVEL SECURITY;");

  // Two branches: the client's own session context, and the owning firm — the
  // CA firm must be able to revoke a client's sessions when it resets that
  // client's portal password. The firm branch uses the same subquery-through-
  // parent shape as extractions/document_versions.
  await knex.raw(`
    CREATE POLICY client_refresh_tokens_isolation_policy
    ON client_refresh_tokens
    FOR ALL
    USING (
      client_id = app.current_client_id()
      OR EXISTS (
        SELECT 1
        FROM clients c
        WHERE c.id = client_refresh_tokens.client_id
          AND c.firm_id = app.current_firm_id()
      )
    )
    WITH CHECK (
      client_id = app.current_client_id()
      OR EXISTS (
        SELECT 1
        FROM clients c
        WHERE c.id = client_refresh_tokens.client_id
          AND c.firm_id = app.current_firm_id()
      )
    );
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
      OR (
        current_setting('app.auth_context', true) = 'client_portal_login'
        AND portal_enabled = true
        AND portal_email IS NOT NULL
        AND lower(portal_email) = lower(NULLIF(current_setting('app.portal_email', true), ''))
        AND deleted_at IS NULL
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

  await knex.raw(
    "DROP POLICY IF EXISTS client_refresh_tokens_isolation_policy ON client_refresh_tokens;"
  );
  await knex.raw("DROP INDEX IF EXISTS idx_client_refresh_tokens_active_lookup;");
  await knex.schema.dropTableIfExists("client_refresh_tokens");

  await knex.raw("DROP FUNCTION IF EXISTS app.current_client_id();");

  await knex.raw("DROP INDEX IF EXISTS idx_clients_portal_enabled;");
  await knex.raw("DROP INDEX IF EXISTS uq_clients_portal_email_active;");
  await knex.schema.alterTable("clients", (table) => {
    table.dropColumn("portal_last_login_at");
    table.dropColumn("portal_enabled");
    table.dropColumn("portal_password_hash");
    table.dropColumn("portal_email");
  });
};
