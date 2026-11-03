/**
 * requestPasswordReset runs before any firm context exists, through the
 * `login` RLS escape hatch on users. It used to JOIN firms in that same query —
 * but firms stays hidden until app.current_firm_id is set, so the JOIN returned
 * zero rows for every user under the least-privilege ca_app role. No token was
 * created and no email sent, while the endpoint still answered "if this email
 * exists, a reset link was sent". Unit tests mock the database and could not see
 * it, same as the signup bug in signup.test.js.
 *
 * Requires a live Postgres with migrations applied. Skipped automatically if
 * DATABASE_URL/APP_DATABASE_URL aren't set.
 */
const crypto = require("crypto");
const { Pool } = require("pg");

const ADMIN_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_DATABASE_URL;
const describeIfDb = ADMIN_URL && APP_URL ? describe : describe.skip;

jest.mock("../../src/services/email.service", () => ({ sendEmail: jest.fn(async () => ({ sent: true })) }));

const { sendEmail } = require("../../src/services/email.service");
const { requestPasswordReset, resetPassword, loginUser } = require("../../src/services/auth.service");
const sharedAppPool = require("../../src/db/pool");

describeIfDb("Password reset under RLS", () => {
  let adminPool;
  const firmId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const email = `reset-test-${Date.now()}@test.local`;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL });
    await adminPool.query(`INSERT INTO firms (id, name, owner_email) VALUES ($1, 'Reset Test Firm', $2)`, [firmId, email]);
    await adminPool.query(
      `INSERT INTO users (id, firm_id, name, email, password_hash, role) VALUES ($1, $2, 'Reset Tester', $3, 'x', 'admin')`,
      [userId, firmId, email]
    );
  });

  afterAll(async () => {
    await adminPool.query(`DELETE FROM refresh_tokens WHERE firm_id = $1`, [firmId]);
    await adminPool.query(`DELETE FROM password_reset_tokens WHERE firm_id = $1`, [firmId]);
    await adminPool.query(`DELETE FROM audit_logs WHERE firm_id = $1`, [firmId]);
    await adminPool.query(`DELETE FROM users WHERE firm_id = $1`, [firmId]);
    await adminPool.query(`DELETE FROM firms WHERE id = $1`, [firmId]);
    await adminPool.end();
    await sharedAppPool.end();
  });

  beforeEach(() => sendEmail.mockClear());

  it("creates a reset token and emails a link for a real user (email is matched case-insensitively)", async () => {
    await requestPasswordReset({ email: email.toUpperCase(), userAgent: "jest", ipAddress: "127.0.0.1" });

    const { rows } = await adminPool.query(
      `SELECT id FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL AND deleted_at IS NULL`,
      [userId]
    );
    expect(rows).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].html).toMatch(/reset-password\//);
  });

  it("sends nothing for an unknown email, with the same response shape", async () => {
    const known = await requestPasswordReset({ email, userAgent: "jest", ipAddress: "127.0.0.1" });
    sendEmail.mockClear();
    const unknown = await requestPasswordReset({ email: "nobody@nowhere.in", userAgent: "jest", ipAddress: "127.0.0.1" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(Object.keys(unknown).sort()).toEqual(Object.keys(known).sort());
  });

  it("the emailed link actually resets the password, once", async () => {
    await requestPasswordReset({ email, userAgent: "jest", ipAddress: "127.0.0.1" });
    const token = sendEmail.mock.calls[0][0].html.match(/reset-password\/([A-Za-z0-9_-]+)/)[1];

    await resetPassword({ token, password: "Fresh!Passw0rd2026" });
    const login = await loginUser({ email, password: "Fresh!Passw0rd2026", userAgent: "jest", ipAddress: "127.0.0.1" });
    expect(login.accessToken).toEqual(expect.any(String));

    await expect(resetPassword({ token, password: "Again!Passw0rd2026" })).rejects.toMatchObject({ statusCode: 404 });
  });
});
