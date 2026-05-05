exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE item_name_mappings FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS item_name_mappings_firm_isolation ON item_name_mappings;

    CREATE POLICY item_name_mappings_firm_isolation
    ON item_name_mappings
    FOR ALL
    USING (
      firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid
    )
    WITH CHECK (
      firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid
    );
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP POLICY IF EXISTS item_name_mappings_firm_isolation ON item_name_mappings;

    CREATE POLICY item_name_mappings_firm_isolation ON item_name_mappings
      USING (firm_id = current_setting('app.current_firm_id')::uuid);

    ALTER TABLE item_name_mappings NO FORCE ROW LEVEL SECURITY;
  `);
};
