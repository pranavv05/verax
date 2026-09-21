import { describe, test, expect } from "vitest";
import { isAdmin } from "../../src/utils/permissions";

describe("isAdmin", () => {
  test("returns true when role is exactly 'admin'", () => {
    expect(isAdmin({ role: "admin" })).toBe(true);
  });

  test("returns false for a staff role", () => {
    expect(isAdmin({ role: "staff" })).toBe(false);
  });

  test("returns false when user is null or undefined", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  test("returns false when role is missing", () => {
    expect(isAdmin({})).toBe(false);
  });

  test("is case-sensitive — 'Admin' does not match", () => {
    expect(isAdmin({ role: "Admin" })).toBe(false);
  });
});
