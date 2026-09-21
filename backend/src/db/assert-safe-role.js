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
  const result = await pool.query("SELECT usesuper FROM pg_user WHERE usename = current_user");
  if (result.rows[0]?.usesuper) {
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

module.exports = { assertRuntimeRoleIsNotSuperuser };
