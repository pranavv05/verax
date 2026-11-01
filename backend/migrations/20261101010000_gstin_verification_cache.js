/**
 * GSTIN verification cache.
 *
 * verifyGSTIN previously hit the GSP (or the local checksum fallback) on every
 * single call, including re-verifying the same supplier GSTIN seen on hundreds
 * of invoices. A GSTIN's registration status is GLOBAL reference data — it is
 * the same for every firm — so it is cached once here, not per tenant.
 *
 * This table therefore has NO row-level security and no firm_id, deliberately,
 * following the existing `waitlist` table precedent for non-tenant data. It
 * holds only public GST-registry facts (legal/trade name, registration status,
 * state code) that the GST portal itself exposes to anyone — nothing
 * firm-specific or sensitive. The ca_app runtime role gets SELECT/INSERT/UPDATE
 * through the default privileges granted in the least-privilege-role migration.
 *
 * Rows carry a `source` and `fetched_at` so the service can treat a cheap local
 * checksum result as refreshable (re-verify against a GSP once one is
 * configured) while trusting a GSP result for a sensible TTL.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable("gstin_verification_cache", (table) => {
    table.string("gstin", 15).primary();
    table.boolean("valid").notNullable();
    table.string("legal_name", 255);
    table.string("trade_name", 255);
    table.string("registration_status", 50);
    table.string("state_code", 2);
    // Where this result came from: a live GSP, or the offline checksum check.
    // A "local_checksum" row is a weak result worth upgrading when a GSP is
    // later configured; a "gsp" row is authoritative until it ages out.
    table.string("source", 20).notNullable().defaultTo("local_checksum");
    table.text("message");
    table.timestamp("fetched_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(["source"], "idx_gstin_cache_source");
  });

  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'set_updated_at'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
      ) THEN
        CREATE TRIGGER gstin_verification_cache_set_updated_at
        BEFORE UPDATE ON gstin_verification_cache
        FOR EACH ROW
        EXECUTE FUNCTION app.set_updated_at();
      END IF;
    END;
    $$;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(
    "DROP TRIGGER IF EXISTS gstin_verification_cache_set_updated_at ON gstin_verification_cache;"
  );
  await knex.schema.dropTableIfExists("gstin_verification_cache");
};
