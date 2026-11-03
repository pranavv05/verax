jest.mock("../../src/db/pool", () => ({ query: jest.fn() }));
const pool = require("../../src/db/pool");
const { assertRuntimeRoleIsNotSuperuser, assertOwnedTablesForceRls } = require("../../src/db/assert-safe-role");

describe("assertRuntimeRoleIsNotSuperuser", () => {
  test("refuses a superuser", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ rolsuper: true, rolbypassrls: true }] });
    await expect(assertRuntimeRoleIsNotSuperuser()).rejects.toThrow(/superuser/);
  });
  test("refuses a BYPASSRLS role", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ rolsuper: false, rolbypassrls: true }] });
    await expect(assertRuntimeRoleIsNotSuperuser()).rejects.toThrow(/BYPASSRLS/);
  });
  test("accepts an ordinary role", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ rolsuper: false, rolbypassrls: false }] });
    await expect(assertRuntimeRoleIsNotSuperuser()).resolves.toBeUndefined();
  });
});

describe("assertOwnedTablesForceRls", () => {
  test("refuses when a table this role owns has RLS without FORCE, naming it", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 2, rows: [{ relname: "documents" }, { relname: "firms" }] });
    await expect(assertOwnedTablesForceRls()).rejects.toThrow(/owner of documents, firms.*FORCE ROW LEVEL SECURITY/s);
  });
  test("accepts when every owned RLS table is forced (or the role owns none)", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(assertOwnedTablesForceRls()).resolves.toBeUndefined();
  });
});
