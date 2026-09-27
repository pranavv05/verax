/**
 * The daily "documents ready" digest runs once for every firm, so the
 * scheduler has to be able to list firms. firms_isolation_policy only shows a
 * session its own firm, so under the least-privilege app role the scheduler
 * saw none.
 *
 * Adds a read-only policy for the `scheduler` auth context, mirroring the
 * scheduled_requests policy (20260511000000_scheduled_requests.js). It grants
 * no writes, and every per-firm read and write in the digest still runs in
 * that firm's own tenant context.
 */

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE POLICY firms_scheduler_read_policy
    ON firms
    FOR SELECT
    USING (current_setting('app.auth_context', true) = 'scheduler');
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP POLICY IF EXISTS firms_scheduler_read_policy ON firms;");
};
