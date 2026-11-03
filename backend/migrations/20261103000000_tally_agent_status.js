/**
 * What the Tally agent last saw on its machine: "ready", or why it is holding
 * jobs back (Tally closed, wrong company open, several companies open). The
 * agent refuses to claim jobs while Tally isn't ready, so without this a firm
 * would only see vouchers sitting "queued" with no reason.
 */
exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE tally_agents ADD COLUMN tally_status VARCHAR(200)`);
};

exports.down = async function down(knex) {
  await knex.raw(`ALTER TABLE tally_agents DROP COLUMN IF EXISTS tally_status`);
};
