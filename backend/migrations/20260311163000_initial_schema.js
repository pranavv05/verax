const TABLES_WITH_UPDATED_AT = [
  "firms",
  "users",
  "clients",
  "documents",
  "extractions",
  "tally_exports",
  "audit_logs"
];

const TABLES_WITH_RLS = [
  "firms",
  "users",
  "clients",
  "documents",
  "extractions",
  "tally_exports",
  "audit_logs"
];

exports.up = async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  await knex.raw("CREATE SCHEMA IF NOT EXISTS app;");

  await knex.raw(`
    CREATE OR REPLACE FUNCTION app.current_firm_id()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('app.current_firm_id', true), '')::uuid;
    $$;
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION app.set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$;
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION app.enforce_documents_firm_consistency()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      client_firm_id uuid;
    BEGIN
      SELECT firm_id INTO client_firm_id
      FROM clients
      WHERE id = NEW.client_id;

      IF client_firm_id IS NULL THEN
        RAISE EXCEPTION 'Client % does not exist', NEW.client_id;
      END IF;

      IF NEW.firm_id <> client_firm_id THEN
        RAISE EXCEPTION 'Document firm_id must match client firm_id';
      END IF;

      RETURN NEW;
    END;
    $$;
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION app.enforce_tally_exports_consistency()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      client_firm_id uuid;
      invalid_doc_count integer;
    BEGIN
      SELECT firm_id INTO client_firm_id
      FROM clients
      WHERE id = NEW.client_id;

      IF client_firm_id IS NULL THEN
        RAISE EXCEPTION 'Client % does not exist', NEW.client_id;
      END IF;

      IF NEW.firm_id <> client_firm_id THEN
        RAISE EXCEPTION 'Tally export firm_id must match client firm_id';
      END IF;

      IF COALESCE(array_length(NEW.document_ids, 1), 0) > 0 THEN
        SELECT COUNT(*)
        INTO invalid_doc_count
        FROM unnest(NEW.document_ids) AS doc_id
        LEFT JOIN documents d ON d.id = doc_id
        WHERE d.id IS NULL
          OR d.firm_id <> NEW.firm_id
          OR d.client_id <> NEW.client_id;

        IF invalid_doc_count > 0 THEN
          RAISE EXCEPTION 'All document_ids must belong to the same firm and client';
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_enum') THEN
        CREATE TYPE plan_enum AS ENUM ('starter', 'professional', 'enterprise');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        CREATE TYPE user_role_enum AS ENUM ('admin', 'staff');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_status_enum') THEN
        CREATE TYPE client_status_enum AS ENUM ('active', 'inactive', 'pending');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_type_enum') THEN
        CREATE TYPE doc_type_enum AS ENUM ('invoice', 'bank_statement', 'bill', 'other');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status_enum') THEN
        CREATE TYPE document_status_enum AS ENUM ('uploaded', 'processing', 'extracted', 'reviewed', 'exported');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tally_export_status_enum') THEN
        CREATE TYPE tally_export_status_enum AS ENUM ('generated', 'downloaded', 'failed');
      END IF;
    END;
    $$;
  `);

  await knex.schema.createTable("firms", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("name", 255).notNullable();
    table.string("owner_email", 255).notNullable();
    table.specificType("plan", "plan_enum").notNullable().defaultTo("starter");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("deleted_at", { useTz: true }).nullable();
  });

  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("firm_id").notNullable().references("id").inTable("firms");
    table.string("name", 255).notNullable();
    table.string("email", 255).notNullable();
    table.text("password_hash").notNullable();
    table.specificType("role", "user_role_enum").notNullable().defaultTo("staff");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("deleted_at", { useTz: true }).nullable();

    table.index(["firm_id"], "idx_users_firm_id");
    table.index(["firm_id", "role"], "idx_users_firm_role");
  });

  await knex.schema.createTable("clients", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("firm_id").notNullable().references("id").inTable("firms");
    table.string("name", 255).notNullable();
    table.string("gstin", 15).nullable();
    table.string("email", 255).nullable();
    table.string("phone", 15).nullable();
    table.string("upload_token", 64).notNullable();
    table.timestamp("upload_token_expires_at", { useTz: true }).nullable();
    table.specificType("status", "client_status_enum").notNullable().defaultTo("active");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("deleted_at", { useTz: true }).nullable();

    table.index(["firm_id"], "idx_clients_firm_id");
    table.index(["firm_id", "status"], "idx_clients_firm_status");
  });

  await knex.schema.createTable("documents", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("client_id").notNullable().references("id").inTable("clients");
    table.uuid("firm_id").notNullable().references("id").inTable("firms");
    table.string("file_name", 255).notNullable();
    table.text("s3_key").notNullable();
    table.specificType("doc_type", "doc_type_enum").notNullable().defaultTo("other");
    table
      .specificType("status", "document_status_enum")
      .notNullable()
      .defaultTo("uploaded");
    table.timestamp("uploaded_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.integer("processing_attempts").notNullable().defaultTo(0);
    table.text("processing_error").nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("deleted_at", { useTz: true }).nullable();

    table.index(["firm_id"], "idx_documents_firm_id");
    table.index(["client_id"], "idx_documents_client_id");
    table.index(["firm_id", "status"], "idx_documents_firm_status");
    table.index(["firm_id", "uploaded_at"], "idx_documents_firm_uploaded_at");
  });

  await knex.schema.createTable("extractions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("document_id").notNullable().unique().references("id").inTable("documents");
    table.text("raw_text").nullable();
    table.jsonb("structured_data").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    table.float("confidence_score").nullable();
    table.uuid("reviewed_by").nullable().references("id").inTable("users");
    table.timestamp("reviewed_at", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("deleted_at", { useTz: true }).nullable();

    table.index(["reviewed_by"], "idx_extractions_reviewed_by");
  });

  await knex.schema.createTable("tally_exports", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("firm_id").notNullable().references("id").inTable("firms");
    table.uuid("client_id").notNullable().references("id").inTable("clients");
    table.specificType("document_ids", "uuid[]").notNullable().defaultTo("{}");
    table.text("xml_s3_key").nullable();
    table.uuid("exported_by").nullable().references("id").inTable("users");
    table.timestamp("exported_at", { useTz: true }).nullable();
    table
      .specificType("status", "tally_export_status_enum")
      .notNullable()
      .defaultTo("generated");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("deleted_at", { useTz: true }).nullable();

    table.index(["firm_id"], "idx_tally_exports_firm_id");
    table.index(["client_id"], "idx_tally_exports_client_id");
    table.index(["firm_id", "exported_at"], "idx_tally_exports_firm_exported_at");
  });

  await knex.schema.createTable("audit_logs", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("firm_id").notNullable().references("id").inTable("firms");
    table.uuid("user_id").nullable().references("id").inTable("users");
    table.string("action", 100).notNullable();
    table.string("entity_type", 50).notNullable();
    table.uuid("entity_id").nullable();
    table.jsonb("metadata").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("deleted_at", { useTz: true }).nullable();

    table.index(["firm_id"], "idx_audit_logs_firm_id");
    table.index(["firm_id", "created_at"], "idx_audit_logs_firm_created_at");
    table.index(["action"], "idx_audit_logs_action");
  });

  await knex.raw(`
    CREATE UNIQUE INDEX uq_firms_owner_email_active
    ON firms (owner_email)
    WHERE deleted_at IS NULL;
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX uq_users_email_active
    ON users (email)
    WHERE deleted_at IS NULL;
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX uq_clients_upload_token_active
    ON clients (upload_token)
    WHERE deleted_at IS NULL;
  `);

  for (const tableName of TABLES_WITH_UPDATED_AT) {
    await knex.raw(`
      CREATE TRIGGER ${tableName}_set_updated_at
      BEFORE UPDATE ON ${tableName}
      FOR EACH ROW
      EXECUTE FUNCTION app.set_updated_at();
    `);
  }

  await knex.raw(`
    CREATE TRIGGER documents_tenant_guard
    BEFORE INSERT OR UPDATE OF client_id, firm_id
    ON documents
    FOR EACH ROW
    EXECUTE FUNCTION app.enforce_documents_firm_consistency();
  `);

  await knex.raw(`
    CREATE TRIGGER tally_exports_tenant_guard
    BEFORE INSERT OR UPDATE OF firm_id, client_id, document_ids
    ON tally_exports
    FOR EACH ROW
    EXECUTE FUNCTION app.enforce_tally_exports_consistency();
  `);

  for (const tableName of TABLES_WITH_RLS) {
    await knex.raw(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`);
    await knex.raw(`ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY;`);
  }

  await knex.raw(`
    CREATE POLICY firms_isolation_policy
    ON firms
    FOR ALL
    USING (id = app.current_firm_id())
    WITH CHECK (id = app.current_firm_id());
  `);

  await knex.raw(`
    CREATE POLICY users_isolation_policy
    ON users
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (firm_id = app.current_firm_id());
  `);

  await knex.raw(`
    CREATE POLICY clients_isolation_policy
    ON clients
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (firm_id = app.current_firm_id());
  `);

  await knex.raw(`
    CREATE POLICY documents_isolation_policy
    ON documents
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (firm_id = app.current_firm_id());
  `);

  await knex.raw(`
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
    CREATE POLICY tally_exports_isolation_policy
    ON tally_exports
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (firm_id = app.current_firm_id());
  `);

  await knex.raw(`
    CREATE POLICY audit_logs_isolation_policy
    ON audit_logs
    FOR ALL
    USING (firm_id = app.current_firm_id())
    WITH CHECK (firm_id = app.current_firm_id());
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP POLICY IF EXISTS audit_logs_isolation_policy ON audit_logs;");
  await knex.raw("DROP POLICY IF EXISTS tally_exports_isolation_policy ON tally_exports;");
  await knex.raw("DROP POLICY IF EXISTS extractions_isolation_policy ON extractions;");
  await knex.raw("DROP POLICY IF EXISTS documents_isolation_policy ON documents;");
  await knex.raw("DROP POLICY IF EXISTS clients_isolation_policy ON clients;");
  await knex.raw("DROP POLICY IF EXISTS users_isolation_policy ON users;");
  await knex.raw("DROP POLICY IF EXISTS firms_isolation_policy ON firms;");

  await knex.raw("DROP TRIGGER IF EXISTS tally_exports_tenant_guard ON tally_exports;");
  await knex.raw("DROP TRIGGER IF EXISTS documents_tenant_guard ON documents;");

  for (const tableName of TABLES_WITH_UPDATED_AT) {
    await knex.raw(`DROP TRIGGER IF EXISTS ${tableName}_set_updated_at ON ${tableName};`);
  }

  await knex.schema.dropTableIfExists("audit_logs");
  await knex.schema.dropTableIfExists("tally_exports");
  await knex.schema.dropTableIfExists("extractions");
  await knex.schema.dropTableIfExists("documents");
  await knex.schema.dropTableIfExists("clients");
  await knex.schema.dropTableIfExists("users");
  await knex.schema.dropTableIfExists("firms");

  await knex.raw("DROP FUNCTION IF EXISTS app.enforce_tally_exports_consistency();");
  await knex.raw("DROP FUNCTION IF EXISTS app.enforce_documents_firm_consistency();");
  await knex.raw("DROP FUNCTION IF EXISTS app.set_updated_at();");
  await knex.raw("DROP FUNCTION IF EXISTS app.current_firm_id();");

  await knex.raw("DROP TYPE IF EXISTS tally_export_status_enum;");
  await knex.raw("DROP TYPE IF EXISTS document_status_enum;");
  await knex.raw("DROP TYPE IF EXISTS doc_type_enum;");
  await knex.raw("DROP TYPE IF EXISTS client_status_enum;");
  await knex.raw("DROP TYPE IF EXISTS user_role_enum;");
  await knex.raw("DROP TYPE IF EXISTS plan_enum;");

  await knex.raw("DROP SCHEMA IF EXISTS app;");
};
