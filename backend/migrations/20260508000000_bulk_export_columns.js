exports.up = async function up(knex) {
  const hasExportType = await knex.schema.hasColumn("tally_exports", "export_type");
  const hasDocumentCount = await knex.schema.hasColumn("tally_exports", "document_count");
  const hasFromDate = await knex.schema.hasColumn("tally_exports", "from_date");
  const hasToDate = await knex.schema.hasColumn("tally_exports", "to_date");
  const hasCreatedBy = await knex.schema.hasColumn("tally_exports", "created_by");

  await knex.schema.alterTable("tally_exports", (table) => {
    if (!hasExportType) {
      table.string("export_type", 20).notNullable().defaultTo("single");
    }
    if (!hasDocumentCount) {
      table.integer("document_count").notNullable().defaultTo(0);
    }
    if (!hasFromDate) {
      table.date("from_date").nullable();
    }
    if (!hasToDate) {
      table.date("to_date").nullable();
    }
    if (!hasCreatedBy) {
      table.uuid("created_by").nullable().references("id").inTable("users");
    }
  });

  if (!hasDocumentCount) {
    await knex.raw(
      "UPDATE tally_exports SET document_count = COALESCE(array_length(document_ids, 1), 0)"
    );
  }
};

exports.down = async function down(knex) {
  const hasExportType = await knex.schema.hasColumn("tally_exports", "export_type");
  const hasDocumentCount = await knex.schema.hasColumn("tally_exports", "document_count");
  const hasFromDate = await knex.schema.hasColumn("tally_exports", "from_date");
  const hasToDate = await knex.schema.hasColumn("tally_exports", "to_date");
  const hasCreatedBy = await knex.schema.hasColumn("tally_exports", "created_by");

  await knex.schema.alterTable("tally_exports", (table) => {
    if (hasCreatedBy) {
      table.dropColumn("created_by");
    }
    if (hasToDate) {
      table.dropColumn("to_date");
    }
    if (hasFromDate) {
      table.dropColumn("from_date");
    }
    if (hasDocumentCount) {
      table.dropColumn("document_count");
    }
    if (hasExportType) {
      table.dropColumn("export_type");
    }
  });
};
