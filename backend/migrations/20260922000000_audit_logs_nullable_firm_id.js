/**
 * A failed login attempt against an email that doesn't exist in the system
 * could never be audit-logged: `audit_logs.firm_id` was NOT NULL, and there
 * is no firm to attribute an unknown-email login attempt to. Known-user
 * wrong-password attempts and all successful logins were already logged
 * (they have a real firm_id); only the unknown-email case had this blind
 * spot — a real gap for detecting e.g. credential-stuffing/enumeration
 * attempts against the login endpoint. This applied to both login flows:
 * the firm-side `loginUser` (auth.service.js) and the separate client-portal
 * `clientLogin` (client-auth.service.js).
 *
 * Fix: make firm_id nullable, and add a write-only RLS escape hatch mirroring
 * the existing `app.auth_context = 'login'` pattern already used on `users`
 * for the firm-side login flow (see 20260311171500_auth_infra.js), extended
 * to also cover the client-portal login's own `client_portal_login` context.
 * The escape hatch only permits inserting a NULL-firm_id row during those
 * exact contexts — it does not add any read path, so these rows remain
 * invisible to every firm-scoped session (correctly: they don't belong to
 * any firm). They are write-only audit trail for future security-monitoring
 * tooling, not something a CA firm's own audit log view will ever show.
 */

exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE audit_logs ALTER COLUMN firm_id DROP NOT NULL;
  `);

  await knex.raw(`
    DROP POLICY IF EXISTS audit_logs_isolation_policy ON audit_logs;
    CREATE POLICY audit_logs_isolation_policy
    ON audit_logs
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (
      firm_id = app.current_firm_id()
      OR (
        firm_id IS NULL
        AND current_setting('app.auth_context', true) IN ('login', 'client_portal_login')
      )
    );
  `);
};

exports.down = async function down(knex) {
  // Any NULL-firm_id rows written under the new policy have no firm to
  // reattribute to, so the down migration deletes them rather than leaving
  // rows that would violate the restored NOT NULL constraint.
  await knex.raw(`DELETE FROM audit_logs WHERE firm_id IS NULL;`);

  await knex.raw(`
    DROP POLICY IF EXISTS audit_logs_isolation_policy ON audit_logs;
    CREATE POLICY audit_logs_isolation_policy
    ON audit_logs
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (firm_id = app.current_firm_id());
  `);

  await knex.raw(`
    ALTER TABLE audit_logs ALTER COLUMN firm_id SET NOT NULL;
  `);
};
