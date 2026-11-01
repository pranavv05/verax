// email.service reads env at module load and builds transporters lazily via
// require(), so we mock nodemailer/resend and re-require the service per test
// with a controlled env.

const ORIGINAL_ENV = { ...process.env };

const baseEnv = () => ({
  ...ORIGINAL_ENV,
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci",
  REDIS_URL: "redis://localhost:6379",
  AI_SERVICE_URL: "http://localhost:8001",
  JWT_SECRET: "ci-only-placeholder-secret-not-a-real-secret-32",
  JWT_REFRESH_SECRET: "ci-only-placeholder-refresh-secret-not-real-32",
  CLIENT_JWT_SECRET: "ci-only-placeholder-client-secret-not-real-32",
  FRONTEND_URL: "http://localhost:5173",
  LOCAL_STORAGE: "true"
});

const loadService = (extraEnv) => {
  jest.resetModules();
  process.env = { ...baseEnv(), ...extraEnv };
  return require("../../src/services/email.service");
};

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
  jest.clearAllMocks();
});

describe("sendEmail — provider not configured", () => {
  test("in non-production, logs a preview and returns sent:false with preview", async () => {
    const { sendEmail } = loadService({ NODE_ENV: "test", EMAIL_PROVIDER: "smtp", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "" });
    const result = await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>x</p>" });
    expect(result.sent).toBe(false);
    expect(result.preview).toBe("<p>x</p>");
  });
});

describe("sendEmail — SMTP with retry", () => {
  test("retries a transient failure then succeeds", async () => {
    const sendMail = jest
      .fn()
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
      .mockResolvedValueOnce({});
    jest.doMock("nodemailer", () => ({
      createTransport: () => ({ sendMail, close: jest.fn(), verify: jest.fn() })
    }));

    const { sendEmail } = loadService({
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "u",
      SMTP_PASS: "p"
    });

    const result = await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>x</p>" });
    expect(result.sent).toBe(true);
    expect(result.attempts).toBe(2);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  test("returns sent:false after exhausting retries, never throws", async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error("connection refused"));
    jest.doMock("nodemailer", () => ({
      createTransport: () => ({ sendMail, close: jest.fn(), verify: jest.fn() })
    }));

    const { sendEmail } = loadService({
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "u",
      SMTP_PASS: "p"
    });

    const result = await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>x</p>" });
    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/connection refused/);
    expect(sendMail).toHaveBeenCalledTimes(3);
  });

  test("reuses one transporter across sends (pooling)", async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const createTransport = jest.fn(() => ({ sendMail, close: jest.fn(), verify: jest.fn() }));
    jest.doMock("nodemailer", () => ({ createTransport }));

    const { sendEmail } = loadService({
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "u",
      SMTP_PASS: "p"
    });

    await sendEmail({ to: "a@b.com", subject: "1", html: "<p>1</p>" });
    await sendEmail({ to: "c@d.com", subject: "2", html: "<p>2</p>" });
    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});

describe("verifyTransport", () => {
  test("ok:false, configured:false when nothing is configured", async () => {
    const { verifyTransport } = loadService({
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: ""
    });
    const result = await verifyTransport();
    expect(result).toMatchObject({ ok: false, configured: false });
  });

  test("ok:true when SMTP verify succeeds", async () => {
    jest.doMock("nodemailer", () => ({
      createTransport: () => ({ sendMail: jest.fn(), close: jest.fn(), verify: jest.fn().mockResolvedValue(true) })
    }));
    const { verifyTransport } = loadService({
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "u",
      SMTP_PASS: "p"
    });
    const result = await verifyTransport();
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("smtp");
  });

  test("ok:false with error when SMTP verify fails", async () => {
    jest.doMock("nodemailer", () => ({
      createTransport: () => ({
        sendMail: jest.fn(),
        close: jest.fn(),
        verify: jest.fn().mockRejectedValue(new Error("535 auth failed"))
      })
    }));
    const { verifyTransport } = loadService({
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "u",
      SMTP_PASS: "wrong"
    });
    const result = await verifyTransport();
    expect(result.ok).toBe(false);
    expect(result.configured).toBe(true);
    expect(result.error).toMatch(/535 auth failed/);
  });
});
