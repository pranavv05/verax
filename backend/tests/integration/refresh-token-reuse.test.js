/**
 * The original audit found that `refreshAccessToken`'s reuse-detection
 * branches called `revokeRefreshTokenFamily` and then `throw`ed inside the
 * same `withTenantTransaction` handler — the throw triggers the ROLLBACK in
 * tenant-context.js, discarding the family revocation along with everything
 * else. The caller still saw a correct 401, so a stolen refresh token that
 * triggered reuse detection left every sibling token in the family still
 * live, with no external symptom that anything was wrong.
 *
 * As of commit 5ae0534c the code already returns a `{ reuseDetected: true }`
 * sentinel from inside the transaction (so the revocation commits) and
 * throws only after the transaction resolves — this is a regression test
 * proving that fix actually holds, not a fix itself.
 *
 * Requires a live Postgres with migrations applied. Skipped automatically
 * if DATABASE_URL/APP_DATABASE_URL aren't set, same as rls.test.js.
 */
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;

const describeIfDb = ADMIN_URL && APP_URL ? describe : describe.skip;

const { loginUser, refreshAccessToken } = require("../../src/services/auth.service");
const sharedAppPool = require("../../src/db/pool");

describeIfDb("Refresh token reuse detection actually revokes the family", () => {
  let adminPool;
  const firmId = "13131313-0000-4000-8000-000000000001";
  const userId = "13131313-0000-4000-8000-000000000011";
  const email = "reuse-test@test.local";
  const password = "correct horse battery staple";

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
    await adminPool.query(
      `INSERT INTO firms (id, name, owner_email) VALUES ($1, 'Reuse Test Firm', $2)
       ON CONFLICT (id) DO NOTHING`,
      [firmId, email]
    );
    const passwordHash = await bcrypt.hash(password, 10);
    await adminPool.query(
      `INSERT INTO users (id, firm_id, name, email, password_hash, role)
       VALUES ($1, $2, 'Reuse Test Admin', $3, $4, 'admin')
       ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [userId, firmId, email, passwordHash]
    );
  });

  afterAll(async () => {
    await adminPool.query(`DELETE FROM audit_logs WHERE firm_id = $1`, [firmId]);
    await adminPool.query(`DELETE FROM refresh_tokens WHERE firm_id = $1`, [firmId]);
    await adminPool.query(`DELETE FROM users WHERE firm_id = $1`, [firmId]);
    await adminPool.query(`DELETE FROM firms WHERE id = $1`, [firmId]);
    await adminPool.end();
    await sharedAppPool.end();
  });

  test("reusing a rotated-out refresh token revokes every token in the family, not just the reused one", async () => {
    const { refreshToken: tokenA } = await loginUser({ email, password });

    const { refreshToken: tokenB } = await refreshAccessToken({ refreshToken: tokenA });

    // tokenA is now stale (rotated to tokenB). Replaying it must both fail
    // AND actually revoke tokenB's session — that second part is exactly
    // what the pre-fix rollback bug silently skipped.
    await expect(refreshAccessToken({ refreshToken: tokenA })).rejects.toThrow(
      /revoked|mismatch/i
    );

    await expect(refreshAccessToken({ refreshToken: tokenB })).rejects.toThrow();

    const { rows } = await adminPool.query(
      `SELECT token_id, revoked_at FROM refresh_tokens WHERE firm_id = $1 AND user_id = $2`,
      [firmId, userId]
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.revoked_at).not.toBeNull();
    }
  });
});
