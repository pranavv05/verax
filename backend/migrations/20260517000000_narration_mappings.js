exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE narration_mappings (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firm_id            UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      narration_pattern  VARCHAR(500) NOT NULL,
      ledger_name        VARCHAR(255) NOT NULL,
      match_type         VARCHAR(20) NOT NULL DEFAULT 'contains'
                           CHECK (match_type IN ('exact', 'contains', 'starts_with')),
      usage_count        INTEGER NOT NULL DEFAULT 1,
      created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (firm_id, narration_pattern, match_type)
    );

    CREATE INDEX idx_narration_mappings_firm_id ON narration_mappings (firm_id);
    CREATE INDEX idx_narration_mappings_firm_usage ON narration_mappings (firm_id, usage_count DESC);

    ALTER TABLE narration_mappings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE narration_mappings FORCE ROW LEVEL SECURITY;

    CREATE POLICY narration_mappings_firm_isolation
    ON narration_mappings
    FOR ALL
    USING (
      firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid
    )
    WITH CHECK (
      firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid
    );

    CREATE TRIGGER set_updated_at_narration_mappings
      BEFORE UPDATE ON narration_mappings
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS narration_mappings CASCADE;
  `);
};
