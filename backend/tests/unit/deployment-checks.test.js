const { getFrontendDomainWarning } = require("../../src/config/deployment-checks");

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
