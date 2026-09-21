/**
 * The client-portal auth world (app.current_client_id(), set only on
 * client-portal sessions) was correctly enforced by RLS on `clients` and
 * `client_refresh_tokens`, but NOT on the three tables clients actually read
 * data from: `documents`, `extractions`, `tally_exports`. Those were scoped
 * only by firm_id, so sibling-client isolation within one firm was enforced
 * entirely at the application layer — every client-portal route had to
 * remember to add its own `client_id = $` filter. That held today (verified),
 * but had zero database-level backstop: one missed filter in a future route
 * and client A could read client B's documents within the same firm, and RLS
 * would not catch it.
 *
 * This migration adds a client_id branch to those three policies. When
 * app.current_client_id() is NULL (an ordinary firm/staff session), behavior
 * is unchanged — firm_id scoping only. When it is set (a client-portal
 * session), rows are additionally scoped to that one client.
 */

exports.up = async function up(knex) {
  await knex.raw(`
    DROP POLICY IF EXISTS documents_isolation_policy ON documents;
    CREATE POLICY documents_isolation_policy
    ON documents
    FOR ALL
    USING (
      firm_id = app.current_firm_id()
      AND (app.current_client_id() IS NULL OR client_id = app.current_client_id())
    )
    WITH CHECK (
      firm_id = app.current_firm_id()
      AND (app.current_client_id() IS NULL OR client_id = app.current_client_id())
    );
  `);

  await knex.raw(`
    DROP POLICY IF EXISTS extractions_isolation_policy ON extractions;
    CREATE POLICY extractions_isolation_policy
    ON extractions
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM documents d
        WHERE d.id = extractions.document_id
          AND d.firm_id = app.current_firm_id()
          AND (app.current_client_id() IS NULL OR d.client_id = app.current_client_id())
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM documents d
        WHERE d.id = extractions.document_id
          AND d.firm_id = app.current_firm_id()
          AND (app.current_client_id() IS NULL OR d.client_id = app.current_client_id())
      )
    );
  `);

  await knex.raw(`
    DROP POLICY IF EXISTS tally_exports_isolation_policy ON tally_exports;
    CREATE POLICY tally_exports_isolation_policy
    ON tally_exports
    FOR ALL
    USING (
      firm_id = app.current_firm_id()
      AND (app.current_client_id() IS NULL OR client_id = app.current_client_id())
    )
    WITH CHECK (
      firm_id = app.current_firm_id()
      AND (app.current_client_id() IS NULL OR client_id = app.current_client_id())
    );
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP POLICY IF EXISTS tally_exports_isolation_policy ON tally_exports;
    CREATE POLICY tally_exports_isolation_policy
    ON tally_exports
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (firm_id = app.current_firm_id());
  `);

  await knex.raw(`
    DROP POLICY IF EXISTS extractions_isolation_policy ON extractions;
    CREATE POLICY extractions_isolation_policy
    ON extractions
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM documents d
        WHERE d.id = extractions.document_id
          AND d.firm_id = app.current_firm_id()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM documents d
        WHERE d.id = extractions.document_id
          AND d.firm_id = app.current_firm_id()
      )
    );
  `);

  await knex.raw(`
    DROP POLICY IF EXISTS documents_isolation_policy ON documents;
    CREATE POLICY documents_isolation_policy
    ON documents
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (firm_id = app.current_firm_id());
  `);
};
