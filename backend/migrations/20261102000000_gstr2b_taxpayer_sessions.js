/**
 * GST taxpayer sessions — the per-client OTP consent + token store for live
 * GSTR-2B pulls via a GSP (Sandbox).
 *
 * Pulling a client's GSTR-2B requires a taxpayer-level token that the client
 * authorises once per GSTIN via an OTP sent by GSTN (see sandbox-gsp.service).
 * That token is valid ~6h and refreshable up to a portal-set maximum. This
 * table holds one session per (firm, client): the ENCRYPTED token (never
 * plaintext — see utils/secret-box, AES-256-GCM with GSP_TOKEN_ENCRYPTION_KEY),
 * the GSTIN it is for, expiry timestamps, and a status so the UI can show
 * connected / expired / needs-reauth.
 *
 * Also adds clients.gst_username (the client's GST-portal login, usually their
 * registered email) which the OTP request needs and which is reused on refresh.
 *
 * RLS: firm-scoped, FORCE, app.current_firm_id — same pattern as the other new
 * tables; ca_app inherits grants via default privileges.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable("clients", (table) => {
    // The client's GST-portal username (registered email in most cases). Needed
    // for the OTP request and reused on every session refresh.
    table.string("gst_username", 255).nullable();
  });

  await knex.raw(`
    CREATE TABLE gstr2b_taxpayer_sessions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firm_id          UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      -- The GSTIN this session authorises. Stored so a changed client GSTIN
      -- invalidates the session rather than pulling the wrong taxpayer's data.
      gstin            VARCHAR(15) NOT NULL,
      -- AES-256-GCM encrypted taxpayer token (v1:iv:tag:ciphertext). Never plain.
      token_encrypted  TEXT,
      -- GSP provider that issued it, so a provider switch forces re-auth.
      provider         VARCHAR(20) NOT NULL DEFAULT 'sandbox',
      status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'active', 'expired', 'revoked')),
      -- When the token itself expires, and the longer portal-set session cap
      -- after which a fresh OTP is required even with refresh.
      token_expiry     TIMESTAMPTZ,
      session_expiry   TIMESTAMPTZ,
      last_refreshed_at TIMESTAMPTZ,
      created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      -- One session per client+gstin; re-auth updates it in place.
      UNIQUE (firm_id, client_id, gstin)
    );

    CREATE INDEX idx_gstr2b_sessions_lookup
      ON gstr2b_taxpayer_sessions (firm_id, client_id);

    ALTER TABLE gstr2b_taxpayer_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE gstr2b_taxpayer_sessions FORCE ROW LEVEL SECURITY;

    CREATE POLICY gstr2b_taxpayer_sessions_firm_isolation
    ON gstr2b_taxpayer_sessions
    FOR ALL
    USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
    WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);

    CREATE TRIGGER set_updated_at_gstr2b_taxpayer_sessions
      BEFORE UPDATE ON gstr2b_taxpayer_sessions
      FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP TABLE IF EXISTS gstr2b_taxpayer_sessions CASCADE;`);
  await knex.schema.alterTable("clients", (table) => {
    table.dropColumn("gst_username");
  });
};
