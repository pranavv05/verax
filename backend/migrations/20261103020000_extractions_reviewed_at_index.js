/**
 * The dashboard's 14-day "approved per day" trend filters extractions by
 * reviewed_at. Unindexed, Postgres walked every extraction the firm ever had
 * (each with an RLS check) — ~0.9s at 288k invoices and growing. With the
 * index it reads only the last fortnight's reviews.
 */
exports.up = async function up(knex) {
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS idx_extractions_reviewed_at ON extractions (reviewed_at) WHERE deleted_at IS NULL AND reviewed_at IS NOT NULL`
  );
};

exports.down = async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS idx_extractions_reviewed_at`);
};
