/**
 * documents.invoice_date: the invoice date from the document's extraction,
 * kept in an indexed column so GST reconciliation and the ITC Desk read one
 * period's invoices instead of a client's (or the whole firm's) entire history.
 * Without it, those views got slower every month a firm used Verax.
 *
 * Maintained by a trigger on extractions. Only clean ISO dates (YYYY-MM-DD…)
 * are stored; anything else is NULL and the reconciliation query always
 * includes NULL-dated documents, leaving the exact date check to the existing
 * JS filter — so this column can only ever narrow the rows read, never change
 * the result.
 *
 * The trigger can't miss under RLS: extractions_isolation_policy requires the
 * document to be visible in the writer's firm/client context, and that is the
 * same predicate documents_isolation_policy uses, so any extraction write that
 * succeeds can also update its document.
 */

exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE documents ADD COLUMN invoice_date DATE`);

  await knex.raw(`
    -- Same key precedence as reconciliation.service.js buildInvoiceFromExtraction.
    -- Never raises: a bad date (e.g. 2026-02-30) is NULL, not a failed write.
    CREATE OR REPLACE FUNCTION app.extraction_invoice_date(data jsonb) RETURNS date
    LANGUAGE plpgsql IMMUTABLE AS $$
    DECLARE raw text;
    BEGIN
      raw := COALESCE(
        NULLIF(data->>'invoice_date', ''),
        NULLIF(data->>'invoiceDate', ''),
        NULLIF(data->>'date', ''),
        NULLIF(data->>'document_date', '')
      );
      IF raw IS NULL OR raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN
        RETURN NULL;
      END IF;
      RETURN make_date(substr(raw, 1, 4)::int, substr(raw, 6, 2)::int, substr(raw, 9, 2)::int);
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END $$;

    CREATE OR REPLACE FUNCTION app.sync_document_invoice_date() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE d date := app.extraction_invoice_date(NEW.structured_data);
    BEGIN
      UPDATE documents SET invoice_date = d
      WHERE id = NEW.document_id AND invoice_date IS DISTINCT FROM d;
      RETURN NEW;
    END $$;

    CREATE TRIGGER extractions_sync_invoice_date
      AFTER INSERT OR UPDATE OF structured_data ON extractions
      FOR EACH ROW EXECUTE FUNCTION app.sync_document_invoice_date();
  `);

  // Backfill. Both tables FORCE RLS, which binds even their owner (the
  // migration role on managed Postgres), so with no firm context the UPDATE
  // would see no rows. Lifting FORCE inside this migration's transaction is
  // invisible to other sessions (ALTER TABLE holds an exclusive lock until
  // commit) — the same approach as 20260505000000_harden_item_name_mappings_rls.
  await knex.raw(`
    ALTER TABLE documents NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE extractions NO FORCE ROW LEVEL SECURITY;
    UPDATE documents d
      SET invoice_date = app.extraction_invoice_date(e.structured_data)
      FROM extractions e
      WHERE e.document_id = d.id;
    ALTER TABLE documents FORCE ROW LEVEL SECURITY;
    ALTER TABLE extractions FORCE ROW LEVEL SECURITY;
  `);

  await knex.raw(`
    CREATE INDEX idx_documents_firm_invoice_date
      ON documents (firm_id, invoice_date) WHERE deleted_at IS NULL;
    CREATE INDEX idx_documents_firm_client_invoice_date
      ON documents (firm_id, client_id, invoice_date) WHERE deleted_at IS NULL;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP TRIGGER IF EXISTS extractions_sync_invoice_date ON extractions;
    DROP FUNCTION IF EXISTS app.sync_document_invoice_date();
    DROP FUNCTION IF EXISTS app.extraction_invoice_date(jsonb);
    DROP INDEX IF EXISTS idx_documents_firm_invoice_date;
    DROP INDEX IF EXISTS idx_documents_firm_client_invoice_date;
    ALTER TABLE documents DROP COLUMN IF EXISTS invoice_date;
  `);
};
