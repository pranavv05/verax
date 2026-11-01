/**
 * GSTR-2B snapshots — the data source for reconciliation when no live GSP is
 * connected.
 *
 * Reconciliation (reconciliation.service.js / gsp.service.matchGSTR2B) needs the
 * supplier records the GST portal publishes in a client's GSTR-2B for a period.
 * A live GSP pulls them over an API, but a GSP account takes weeks to provision
 * and carries a fixed monthly cost. Every firm can already download the same
 * GSTR-2B as JSON or Excel from the GST portal today, at no cost.
 *
 * This table stores one parsed snapshot per (firm, client, period): the
 * normalised supplier records plus enough provenance (source, file name,
 * uploader, record and amount totals) to show the firm what they are reconciling
 * against and when it was last refreshed. The reconciliation layer reads the
 * newest snapshot for the period; a live GSP, once configured, writes a
 * snapshot through the same table so both paths converge on one source of truth.
 *
 * RLS mirrors narration_mappings: firm-scoped via app.current_firm_id, FORCE
 * ROW LEVEL SECURITY so even the table owner is constrained, and the ca_app
 * runtime role inherits SELECT/INSERT/UPDATE/DELETE through the default
 * privileges granted in 20260825000000_create_least_privilege_app_role.js.
 */

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE gstr2b_snapshots (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      -- GST return period in MMYYYY form, matching the API contract used across
      -- compliance.routes.js and reconciliation.service.js.
      period          VARCHAR(6) NOT NULL CHECK (period ~ '^(0[1-9]|1[0-2])[0-9]{4}$'),
      -- Where the records came from: an uploaded portal file, or a live GSP pull.
      source          VARCHAR(20) NOT NULL DEFAULT 'offline_upload'
                        CHECK (source IN ('offline_upload', 'gsp')),
      -- Original file name (offline uploads only) for display and audit.
      source_filename VARCHAR(500),
      -- Normalised supplier records: an array of
      -- { invoiceNumber, supplierGSTIN, supplierName, taxableAmount, gstAmount,
      --   invoiceDate, raw } objects, already in the shape matchInvoices expects.
      records         JSONB NOT NULL DEFAULT '[]'::jsonb,
      record_count    INTEGER NOT NULL DEFAULT 0,
      -- Sum of taxable and GST across records, stored at ingest so the UI and
      -- the "ITC at risk" views never re-sum a large JSONB array per request.
      total_taxable   NUMERIC(18, 2) NOT NULL DEFAULT 0,
      total_gst       NUMERIC(18, 2) NOT NULL DEFAULT 0,
      uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Reconciliation reads the newest snapshot for a (firm, client, period),
    -- so index that lookup directly, newest first.
    CREATE INDEX idx_gstr2b_snapshots_lookup
      ON gstr2b_snapshots (firm_id, client_id, period, created_at DESC);

    ALTER TABLE gstr2b_snapshots ENABLE ROW LEVEL SECURITY;
    ALTER TABLE gstr2b_snapshots FORCE ROW LEVEL SECURITY;

    CREATE POLICY gstr2b_snapshots_firm_isolation
    ON gstr2b_snapshots
    FOR ALL
    USING (
      firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid
    )
    WITH CHECK (
      firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid
    );

    CREATE TRIGGER set_updated_at_gstr2b_snapshots
      BEFORE UPDATE ON gstr2b_snapshots
      FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS gstr2b_snapshots CASCADE;
  `);
};
