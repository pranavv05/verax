/**
 * Row Level Security only isolates tenants when the connecting role is NOT a
 * Postgres superuser — Postgres exempts superusers from RLS entirely,
 * FORCE ROW LEVEL SECURITY notwithstanding. In the self-hosted docker-compose
 * setup, the official postgres image's bootstrap role (POSTGRES_USER) IS a
 * superuser, so the application was silently bypassing every RLS policy in
 * that deployment path — any firm could read any other firm's data.
 *
 * This migration creates a dedicated, non-superuser `ca_app` role for the
 * application's runtime connection (migrations keep running as the bootstrap
 * role, which needs DDL rights this role intentionally does not have).
 * Operators must point the app's DATABASE_URL (or APP_DATABASE_URL, see
 * src/db/pool.js) at this role after running migrations. Render's managed
 * Postgres already provisions a non-superuser connection role by default,
 * so this migration is a no-op there in practice — it only matters for
 * self-hosted deployments.
 */

const APP_ROLE = "ca_app";

exports.up = async (knex) => {
  // Password comes from APP_DB_PASSWORD. Falls back to a fixed dev-only
  // value so local/dev/CI setups that haven't set the new var keep working —
  // production deployments MUST set APP_DB_PASSWORD explicitly (documented
  // in .env.production.example and docker-compose.prod.yml).
  const password = process.env.APP_DB_PASSWORD || "ca_app_dev_password_change_me";

  await knex.raw(
    `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
          CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${password.replace(/'/g, "''")}'
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        ELSE
          ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${password.replace(/'/g, "''")}'
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        END IF;
      END
      $$;
    `
  );

  await knex.raw(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE};`);
  await knex.raw(`GRANT USAGE ON SCHEMA app TO ${APP_ROLE};`);
  await knex.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE};`);
  await knex.raw(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE};`);
  await knex.raw(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO ${APP_ROLE};`);

  // Forward-proof future migrations: any new table/sequence/function the
  // bootstrap role creates from here on is auto-granted to ca_app too, so
  // this doesn't need to be repeated in every future migration.
  await knex.raw(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE};`
  );
  await knex.raw(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${APP_ROLE};`);
  await knex.raw(`ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT EXECUTE ON FUNCTIONS TO ${APP_ROLE};`);
};

exports.down = async (knex) => {
  await knex.raw(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM ${APP_ROLE};`
  );
  await knex.raw(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM ${APP_ROLE};`);
  await knex.raw(`ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM ${APP_ROLE};`);
  await knex.raw(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${APP_ROLE};`);
  await knex.raw(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${APP_ROLE};`);
  await knex.raw(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM ${APP_ROLE};`);
  await knex.raw(`REVOKE ALL ON SCHEMA public FROM ${APP_ROLE};`);
  await knex.raw(`REVOKE ALL ON SCHEMA app FROM ${APP_ROLE};`);
  await knex.raw(`DROP ROLE IF EXISTS ${APP_ROLE};`);
};
