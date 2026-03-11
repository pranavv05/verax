exports.up = async function up(knex) {
  await knex.schema.createTable("document_upload_sessions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("firm_id").notNullable().references("id").inTable("firms");
    table.uuid("client_id").notNullable().references("id").inTable("clients");
    table.uuid("created_by").nullable().references("id").inTable("users");
    table.string("source", 16).notNullable().defaultTo("auth");
    table.string("file_name", 255).notNullable();
    table.string("file_type", 150).notNullable();
    table.bigInteger("file_size").notNullable();
    table.specificType("doc_type", "doc_type_enum").notNullable().defaultTo("other");
    table.text("s3_key").notNullable();
    table.timestamp("upload_expires_at", { useTz: true }).notNullable();
    table.timestamp("confirmed_at", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("deleted_at", { useTz: true }).nullable();

    table.index(["firm_id"], "idx_doc_upload_sessions_firm_id");
    table.index(["client_id"], "idx_doc_upload_sessions_client_id");
    table.index(["firm_id", "client_id"], "idx_doc_upload_sessions_firm_client");
    table.index(["upload_expires_at"], "idx_doc_upload_sessions_expires_at");
  });

  await knex.raw(`
    CREATE UNIQUE INDEX uq_doc_upload_sessions_s3_key_active
    ON document_upload_sessions (s3_key)
    WHERE deleted_at IS NULL;
  `);

  await knex.raw(`
    CREATE TRIGGER document_upload_sessions_set_updated_at
    BEFORE UPDATE ON document_upload_sessions
    FOR EACH ROW
    EXECUTE FUNCTION app.set_updated_at();
  `);

  await knex.raw("ALTER TABLE document_upload_sessions ENABLE ROW LEVEL SECURITY;");
  await knex.raw("ALTER TABLE document_upload_sessions FORCE ROW LEVEL SECURITY;");

  await knex.raw(`
    CREATE POLICY document_upload_sessions_isolation_policy
    ON document_upload_sessions
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (firm_id = app.current_firm_id());
  `);
};

exports.down = async function down(knex) {
  await knex.raw(
    "DROP POLICY IF EXISTS document_upload_sessions_isolation_policy ON document_upload_sessions;"
  );
  await knex.raw(
    "DROP TRIGGER IF EXISTS document_upload_sessions_set_updated_at ON document_upload_sessions;"
  );
  await knex.schema.dropTableIfExists("document_upload_sessions");
};
