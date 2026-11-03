const pool = require("./pool");

// Postgres never applies Row Level Security to a superuser, regardless of
// FORCE ROW LEVEL SECURITY. If this process ever connects as one — the
// most likely cause being an operator forgetting to set APP_DATABASE_URL,
// or DATABASE_URL's role being a superuser as the stock postgres Docker
// image's bootstrap role is — every tenant-isolation policy in the app is
// silently bypassed with no error and no log line. This check turns that
// into a loud boot failure instead. See migration
// 20260825000000_create_least_privilege_app_role.js for the least-privilege
// role this should be connecting as.
const assertRuntimeRoleIsNotSuperuser = async () => {
  const result = await pool.query(
    "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
  );
  const role = result.rows[0] || {};
  if (role.rolbypassrls && !role.rolsuper) {
    throw new Error(
      "Refusing to start: the database role this process connects as (current_user) has " +
        "BYPASSRLS, so Row Level Security — the isolation between firms — would not apply. " +
        "Connect as a role without BYPASSRLS (APP_DATABASE_URL, or ALTER ROLE ... NOBYPASSRLS)."
    );
  }
  if (role.rolsuper) {
    throw new Error(
      "Refusing to start: the database role this process connects as (current_user) is a " +
        "Postgres superuser. Row Level Security is never applied to a superuser, so every " +
        "firm's data would be readable by every other firm through this process. Set " +
        "APP_DATABASE_URL to the least-privilege `ca_app` role created by migration " +
        "20260825000000_create_least_privilege_app_role.js (run migrations first if it does " +
        "not exist yet)."
    );
  }
};

// When the app connects as the tables' OWNER (managed Postgres such as
// Render, where there is no separate ca_app role), RLS binds it only if the
// table has FORCE ROW LEVEL SECURITY. A restore of an owner-role dump, or a
// hand-run ALTER TABLE ... NO FORCE, silently turns tenant isolation off for
// this process. Refuse to start instead.
const assertOwnedTablesForceRls = async () => {
  const result = await pool.query(
    `SELECT c.relname
       FROM pg_class c
      WHERE c.relkind = 'r'
        AND c.relrowsecurity
        AND NOT c.relforcerowsecurity
        AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
      ORDER BY c.relname`
  );
  if (result.rowCount > 0) {
    const tables = result.rows.map((row) => row.relname).join(", ");
    throw new Error(
      `Refusing to start: this process connects as the owner of ${tables}, which ` +
        `${result.rowCount === 1 ? "has" : "have"} Row Level Security without FORCE — so RLS does not apply ` +
        "to this role and firms could read each other's data. Run: ALTER TABLE <table> FORCE ROW LEVEL " +
        "SECURITY for each (backend/scripts/db-restore.sh does this after a restore)."
    );
  }
};

module.exports = { assertRuntimeRoleIsNotSuperuser, assertOwnedTablesForceRls };
