/**
 * Production performance indexes.
 *
 * Schema verified against the live ca_saas database (information_schema.columns
 * + pg_indexes) before writing this migration. Three indexes requested against
 * this table set were dropped because the target column does not exist:
 *   - extractions.firm_id        -> extractions has no firm_id column (only document_id)
 *   - scheduled_requests.next_run_at -> column is last_sent_at, not next_run_at
 *   - refresh_tokens.family_id   -> column is token_id; already covered by the
 *     existing unique index uq_refresh_tokens_token_id_active
 * Everything else below maps to a real column.
 */

exports.up = async function up(knex) {
  // Documents
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_documents_firm_id ON documents(firm_id);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_documents_firm_client ON documents(firm_id, client_id);`);

  // Extractions (no firm_id column on this table — skipped)
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_extractions_document_id ON extractions(document_id);`);

  // Audit logs
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_audit_logs_firm_id ON audit_logs(firm_id);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);`);

  // Notifications
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_notifications_firm_id ON notifications(firm_id);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read, created_at DESC);`);

  // Clients
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_clients_firm_id ON clients(firm_id);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_clients_gstin ON clients(gstin);`);

  // Tally exports
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_tally_exports_firm_id ON tally_exports(firm_id);`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_tally_exports_client_id ON tally_exports(client_id);`);

  // Refresh tokens (family_id does not exist — skipped, see header note)
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);`);

  // Client refresh tokens
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS idx_client_refresh_tokens_client_id ON client_refresh_tokens(client_id);`
  );

  // Document versions
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);`
  );

  // Scheduled requests (next_run_at does not exist — skipped, see header note)
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_scheduled_requests_firm_id ON scheduled_requests(firm_id);`);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS idx_scheduled_requests_firm_id;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_document_versions_document_id;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_client_refresh_tokens_client_id;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_refresh_tokens_token_hash;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_tally_exports_client_id;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_tally_exports_firm_id;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_clients_gstin;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_clients_firm_id;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_notifications_read;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_notifications_user_id;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_notifications_firm_id;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_audit_logs_entity_type;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_audit_logs_created_at;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_audit_logs_action;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_audit_logs_firm_id;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_extractions_document_id;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_documents_firm_client;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_documents_created_at;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_documents_status;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_documents_client_id;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_documents_firm_id;`);
};
