exports.up = async function up(knex) {
  await knex.schema.createTable("document_versions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("document_id").notNullable().references("id").inTable("documents").onDelete("CASCADE");
    table.integer("version_number").notNullable();
    table.jsonb("extracted_data").notNullable();
    table.string("snapshot_reason", 50).notNullable();
    table.uuid("created_by").nullable().references("id").inTable("users").onDelete("SET NULL");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(["document_id", "version_number"], {
      indexName: "uq_document_versions_document_version"
    });
  });

  await knex.raw(
    "CREATE INDEX idx_document_versions_document_version ON document_versions (document_id, version_number DESC);"
  );
  await knex.raw("ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;");
  await knex.raw("ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;");
  await knex.raw(`
    CREATE POLICY document_versions_isolation_policy
    ON document_versions
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM documents d
        WHERE d.id = document_versions.document_id
          AND d.firm_id = app.current_firm_id()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM documents d
        WHERE d.id = document_versions.document_id
          AND d.firm_id = app.current_firm_id()
      )
    );
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP POLICY IF EXISTS document_versions_isolation_policy ON document_versions;");
  await knex.raw("DROP INDEX IF EXISTS idx_document_versions_document_version;");
  await knex.schema.dropTableIfExists("document_versions");
};
