/**
 * IMS action tracking.
 *
 * Under the GST Invoice Management System, every inbound invoice in a client's
 * GSTR-2B must be acted on — Accept / Reject / Pending — and anything left
 * untouched is DEEMED ACCEPTED into GSTR-2B/3B, which can pull wrong or fake ITC
 * into the return and create liability. This table records, per supplier invoice
 * for a client+period:
 *   - the IMS status GSTN currently reports (ims_status, from the live 2B pull),
 *   - the action the CA intends/has recorded (action),
 * so the firm can see which records are still unactioned (deemed-accept risk)
 * and track Accept/Reject/Pending decisions across the portfolio.
 *
 * This is a tracking/record layer. Pushing actions back to GSTN requires a GSP
 * IMS write API and is out of scope here; the column set is ready for it.
 *
 * RLS: firm-scoped, FORCE, app.current_firm_id — same pattern as the other new
 * tables; ca_app inherits grants via default privileges.
 */

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE ims_actions (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firm_id       UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      period        VARCHAR(6) NOT NULL CHECK (period ~ '^(0[1-9]|1[0-2])[0-9]{4}$'),
      -- Supplier GSTIN + invoice number identify the 2B record within a period.
      supplier_gstin VARCHAR(15) NOT NULL,
      invoice_number VARCHAR(100) NOT NULL,
      -- The IMS status GSTN reports for this record (e.g. N=no action, A=accepted,
      -- R=rejected, P=pending). Stored verbatim from the live pull; nullable when
      -- the record came from an offline upload that doesn't carry it.
      ims_status    VARCHAR(4),
      -- The action the firm intends / has recorded locally.
      action        VARCHAR(10) NOT NULL DEFAULT 'none'
                      CHECK (action IN ('none', 'accept', 'reject', 'pending')),
      -- GST amount on the record, so the deemed-accept risk can be quantified
      -- without re-joining to the snapshot.
      gst_amount    NUMERIC(18, 2) NOT NULL DEFAULT 0,
      note          TEXT,
      acted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      acted_at      TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      -- One action row per invoice within a client+period.
      UNIQUE (firm_id, client_id, period, supplier_gstin, invoice_number)
    );

    CREATE INDEX idx_ims_actions_lookup
      ON ims_actions (firm_id, client_id, period);
    CREATE INDEX idx_ims_actions_unactioned
      ON ims_actions (firm_id, period)
      WHERE action = 'none';

    ALTER TABLE ims_actions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ims_actions FORCE ROW LEVEL SECURITY;

    CREATE POLICY ims_actions_firm_isolation
    ON ims_actions
    FOR ALL
    USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
    WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);

    CREATE TRIGGER set_updated_at_ims_actions
      BEFORE UPDATE ON ims_actions
      FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP TABLE IF EXISTS ims_actions CASCADE;`);
};
