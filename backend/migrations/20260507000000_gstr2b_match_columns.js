exports.up = async function up(knex) {
  await knex.schema.alterTable("documents", (table) => {
    table.string("gstr2b_match_status", 20).nullable().defaultTo(null);
    table.jsonb("gstr2b_match_details").nullable().defaultTo(null);
  });

  await knex.raw(
    "CREATE INDEX idx_documents_gstr2b_match_status ON documents (firm_id, gstr2b_match_status) WHERE deleted_at IS NULL"
  );
};

exports.down = async function down(knex) {
  await knex.raw("DROP INDEX IF EXISTS idx_documents_gstr2b_match_status");

  await knex.schema.alterTable("documents", (table) => {
    table.dropColumn("gstr2b_match_details");
    table.dropColumn("gstr2b_match_status");
  });
};
