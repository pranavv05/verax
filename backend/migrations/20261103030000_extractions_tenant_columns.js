/**
 * extractions.firm_id / extractions.client_id, and an RLS policy that uses
 * them directly.
 *
 * The old policy was EXISTS (SELECT 1 FROM documents d WHERE d.id =
 * extractions.document_id AND <firm/client match>). Every read of extractions
 * paid for it — at scale Postgres hashed every document the firm ever had just
 * to check visibility (~0.3s of the dashboard at 288k invoices, growing).
 *
 * The columns are owned by triggers, never by application code:
 *   - BEFORE INSERT / UPDATE OF document_id on extractions copies them from
 *     the document, overwriting anything supplied. If the document is not
 *     visible in the writer's firm/client context, firm_id stays NULL and the
 *     policy's WITH CHECK rejects the row — the same outcome as the old
 *     EXISTS check.
 *   - AFTER UPDATE OF firm_id, client_id on documents carries a move across.
 *
 * So the new policy admits exactly the rows the old one did.
 */

const OLD_POLICY_BODY = `
  EXISTS (
    SELECT 1
    FROM documents d
    WHERE d.id = extractions.document_id
      AND d.firm_id = app.current_firm_id()
      AND (app.current_client_id() IS NULL OR d.client_id = app.current_client_id())
  )`;

const NEW_POLICY_BODY = `
  firm_id = app.current_firm_id()
  AND (app.current_client_id() IS NULL OR client_id = app.current_client_id())`;

exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE extractions ADD COLUMN firm_id uuid REFERENCES firms(id);
    ALTER TABLE extractions ADD COLUMN client_id uuid REFERENCES clients(id);

    CREATE OR REPLACE FUNCTION app.extractions_set_tenant() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      SELECT d.firm_id, d.client_id INTO NEW.firm_id, NEW.client_id
      FROM documents d WHERE d.id = NEW.document_id;
      RETURN NEW;
    END $$;

    CREATE TRIGGER extractions_set_tenant
      BEFORE INSERT OR UPDATE OF document_id, firm_id, client_id ON extractions
      FOR EACH ROW EXECUTE FUNCTION app.extractions_set_tenant();

    CREATE OR REPLACE FUNCTION app.documents_propagate_tenant() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE extractions SET firm_id = NEW.firm_id, client_id = NEW.client_id
      WHERE document_id = NEW.id
        AND (firm_id IS DISTINCT FROM NEW.firm_id OR client_id IS DISTINCT FROM NEW.client_id);
      RETURN NEW;
    END $$;

    CREATE TRIGGER documents_propagate_tenant
      AFTER UPDATE OF firm_id, client_id ON documents
      FOR EACH ROW
      WHEN (OLD.firm_id IS DISTINCT FROM NEW.firm_id OR OLD.client_id IS DISTINCT FROM NEW.client_id)
      EXECUTE FUNCTION app.documents_propagate_tenant();
  `);

  // Backfill. FORCE RLS binds the owner (the migration role on managed
  // Postgres); lifting it inside this transaction is invisible to others.
  await knex.raw(`
    ALTER TABLE documents NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE extractions NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE extractions DISABLE TRIGGER extractions_set_updated_at;
    UPDATE extractions e SET firm_id = d.firm_id, client_id = d.client_id
      FROM documents d WHERE d.id = e.document_id;
    ALTER TABLE extractions ENABLE TRIGGER extractions_set_updated_at;
    ALTER TABLE extractions ALTER COLUMN firm_id SET NOT NULL;
    ALTER TABLE extractions ALTER COLUMN client_id SET NOT NULL;

    DROP POLICY IF EXISTS extractions_isolation_policy ON extractions;
    CREATE POLICY extractions_isolation_policy ON extractions
      USING (${NEW_POLICY_BODY})
      WITH CHECK (${NEW_POLICY_BODY});

    ALTER TABLE documents FORCE ROW LEVEL SECURITY;
    ALTER TABLE extractions FORCE ROW LEVEL SECURITY;
  `);

  await knex.raw(`
    CREATE INDEX idx_extractions_firm_client ON extractions (firm_id, client_id);
    CREATE INDEX idx_extractions_firm_reviewed_at ON extractions (firm_id, reviewed_at)
      WHERE deleted_at IS NULL AND reviewed_at IS NOT NULL;
    DROP INDEX IF EXISTS idx_extractions_reviewed_at;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP POLICY IF EXISTS extractions_isolation_policy ON extractions;
    CREATE POLICY extractions_isolation_policy ON extractions
      USING (${OLD_POLICY_BODY})
      WITH CHECK (${OLD_POLICY_BODY});
    CREATE INDEX IF NOT EXISTS idx_extractions_reviewed_at ON extractions (reviewed_at)
      WHERE deleted_at IS NULL AND reviewed_at IS NOT NULL;
    DROP INDEX IF EXISTS idx_extractions_firm_reviewed_at;
    DROP INDEX IF EXISTS idx_extractions_firm_client;
    DROP TRIGGER IF EXISTS documents_propagate_tenant ON documents;
    DROP FUNCTION IF EXISTS app.documents_propagate_tenant();
    DROP TRIGGER IF EXISTS extractions_set_tenant ON extractions;
    DROP FUNCTION IF EXISTS app.extractions_set_tenant();
    ALTER TABLE extractions DROP COLUMN IF EXISTS client_id;
    ALTER TABLE extractions DROP COLUMN IF EXISTS firm_id;
  `);
};
