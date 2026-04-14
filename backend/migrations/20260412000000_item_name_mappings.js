exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE item_name_mappings (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      vendor_raw  TEXT NOT NULL,
      tally_name  TEXT NOT NULL,
      use_count   INT NOT NULL DEFAULT 1,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (firm_id, vendor_raw)
    );

    CREATE INDEX idx_item_name_mappings_firm_id ON item_name_mappings (firm_id);

    ALTER TABLE item_name_mappings ENABLE ROW LEVEL SECURITY;

    CREATE POLICY item_name_mappings_firm_isolation ON item_name_mappings
      USING (firm_id = current_setting('app.current_firm_id')::uuid);
    CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
    CREATE TRIGGER set_updated_at_item_name_mappings
      BEFORE UPDATE ON item_name_mappings
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS item_name_mappings CASCADE;
  `);
};
