const { getFrontendDomainWarning, getProductionConfigErrors } = require("../../src/config/deployment-checks");

describe("getFrontendDomainWarning", () => {
  test.each([
    "https://verax.vercel.app",
    "https://verax-frontend.onrender.com",
    "https://preview-123.verax.netlify.app",
    "https://VERAX.VERCEL.APP/"
  ])("warns for a shared platform domain: %s", (url) => {
    expect(getFrontendDomainWarning(url)).toMatch(/logged out on every page reload/);
  });

  test.each([
    "https://app.verax.in",
    "https://app.example.com",
    "http://localhost:5173",
    "https://notvercel.app.example.com",
    "https://myvercel.app"
  ])("does not warn for a domain the firm owns: %s", (url) => {
    expect(getFrontendDomainWarning(url)).toBeNull();
  });

  test("ignores an unparseable URL (env.js validates it separately)", () => {
    expect(getFrontendDomainWarning("not a url")).toBeNull();
  });
});

describe("getProductionConfigErrors", () => {
  const smtp = { EMAIL_PROVIDER: "smtp", SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASS: "p" };

  test("a complete SMTP + S3 setup passes", () => {
    expect(getProductionConfigErrors({ ...smtp, LOCAL_STORAGE: false })).toEqual([]);
  });

  test("Resend with an API key passes", () => {
    expect(getProductionConfigErrors({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_123", LOCAL_STORAGE: false })).toEqual([]);
  });

  test("no email provider at all is refused (the default provider is smtp)", () => {
    const [error] = getProductionConfigErrors({ LOCAL_STORAGE: false });
    expect(error).toMatch(/No email provider configured \(missing SMTP_HOST, SMTP_USER, SMTP_PASS\)/);
  });

  test("a partial SMTP setup names exactly what is missing", () => {
    const [error] = getProductionConfigErrors({ SMTP_HOST: "smtp.example.com", LOCAL_STORAGE: false });
    expect(error).toMatch(/missing SMTP_USER, SMTP_PASS/);
  });

  test("Resend without its key is refused", () => {
    const [error] = getProductionConfigErrors({ EMAIL_PROVIDER: "resend", LOCAL_STORAGE: false });
    expect(error).toMatch(/RESEND_API_KEY is not set/);
  });

  test("local disk storage is refused by default", () => {
    const [error] = getProductionConfigErrors({ ...smtp, LOCAL_STORAGE: true });
    expect(error).toMatch(/LOCAL_STORAGE=true/);
  });

  test("local disk storage is allowed with the explicit self-hosted opt-in", () => {
    expect(
      getProductionConfigErrors({ ...smtp, LOCAL_STORAGE: true, ALLOW_LOCAL_STORAGE_IN_PRODUCTION: true })
    ).toEqual([]);
  });

  test("reports every problem at once", () => {
    expect(getProductionConfigErrors({ LOCAL_STORAGE: true })).toHaveLength(2);
  });
});

describe("env.js in production", () => {
  const SECRET = (c) => c.repeat(40);
  const baseEnv = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    AI_SERVICE_URL: "http://localhost:8000",
    AI_SERVICE_API_KEY: SECRET("k"),
    JWT_SECRET: SECRET("a"),
    JWT_REFRESH_SECRET: SECRET("b"),
    CLIENT_JWT_SECRET: SECRET("c"),
    FRONTEND_URL: "https://app.example.in",
    LOCAL_STORAGE: "false",
    AWS_S3_BUCKET: "verax-test-bucket",
    EMAIL_PROVIDER: "smtp",
    SMTP_HOST: "",
    SMTP_USER: "",
    SMTP_PASS: ""
  };

  const loadEnvWith = (overrides) => {
    const saved = { ...process.env };
    Object.assign(process.env, baseEnv, overrides);
    try {
      let loaded;
      jest.isolateModules(() => {
        loaded = require("../../src/config/env");
      });
      return loaded;
    } finally {
      process.env = saved;
    }
  };

  test("refuses to start without an email provider", () => {
    expect(() => loadEnvWith({})).toThrow(/Production configuration error:[\s\S]*No email provider configured/);
  });

  test("refuses to start on local disk storage", () => {
    expect(() =>
      loadEnvWith({ SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASS: "p", LOCAL_STORAGE: "true" })
    ).toThrow(/LOCAL_STORAGE=true/);
  });

  test("starts when email and storage are configured", () => {
    const env = loadEnvWith({ SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASS: "p" });
    expect(env.NODE_ENV).toBe("production");
    expect(env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION).toBe(false);
  });

  test("development is unaffected (email previews and local storage stay allowed)", () => {
    const env = loadEnvWith({ NODE_ENV: "development", LOCAL_STORAGE: "true" });
    expect(env.LOCAL_STORAGE).toBe(true);
  });
});
