// inviteUser must tell the caller whether the invite email actually went out,
// so the UI never claims "Invite sent." for an email that failed.
jest.mock("../../src/services/email.service", () => ({ sendEmail: jest.fn() }));
jest.mock("bcryptjs", () => ({ hash: jest.fn(async () => "hashed") }));

const { sendEmail } = require("../../src/services/email.service");
const { inviteUser } = require("../../src/services/users.service");

const makeDb = () => ({
  query: jest.fn(async (sql) => {
    if (/SELECT id FROM users/i.test(sql)) return { rowCount: 0, rows: [] };
    if (/FROM firms f/i.test(sql)) return { rowCount: 1, rows: [{ firm_name: "Acme CA", inviter_name: "Admin" }] };
    if (/INSERT INTO users/i.test(sql)) {
      return {
        rowCount: 1,
        rows: [{ id: "u2", name: "Kunal", email: "kunal@acme.in", role: "staff", created_at: null, updated_at: null }]
      };
    }
    return { rowCount: 1, rows: [] };
  })
});

const invite = () =>
  inviteUser(makeDb(), {
    firmId: "f1",
    actorUserId: "u1",
    name: "Kunal",
    email: "kunal@acme.in",
    password: "Temp@Pass12345"
  });

describe("inviteUser", () => {
  beforeEach(() => jest.clearAllMocks());

  test("reports emailSent: true when the invite email is delivered", async () => {
    sendEmail.mockResolvedValue({ sent: true });
    const result = await invite();
    expect(result.emailSent).toBe(true);
    expect(result.user).toMatchObject({ id: "u2", email: "kunal@acme.in" });
  });

  test("reports emailSent: false when delivery fails, instead of pretending it was sent", async () => {
    sendEmail.mockResolvedValue({ sent: false, error: "connect ECONNREFUSED" });
    const result = await invite();
    expect(result.emailSent).toBe(false);
    expect(result.user).toMatchObject({ id: "u2" });
  });
});
