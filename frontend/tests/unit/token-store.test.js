import { describe, test, expect, beforeEach } from "vitest";
import { tokenStore, userStore } from "../../src/lib/token-store";

describe("tokenStore", () => {
  beforeEach(() => {
    tokenStore.clearAccessToken();
  });

  test("starts with no access token", () => {
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  test("setAccessToken stores and getAccessToken retrieves it", () => {
    tokenStore.setAccessToken("abc.def.ghi");
    expect(tokenStore.getAccessToken()).toBe("abc.def.ghi");
  });

  test("setAccessToken with a falsy value normalizes to null (never stores an empty/undefined token)", () => {
    tokenStore.setAccessToken("");
    expect(tokenStore.getAccessToken()).toBeNull();
    tokenStore.setAccessToken(undefined);
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  test("clearAccessToken resets to null", () => {
    tokenStore.setAccessToken("something");
    tokenStore.clearAccessToken();
    expect(tokenStore.getAccessToken()).toBeNull();
  });
});

describe("userStore", () => {
  beforeEach(() => {
    userStore.clearUser();
  });

  test("starts with no user", () => {
    expect(userStore.getUser()).toBeNull();
  });

  test("setUser stores and getUser retrieves it", () => {
    const user = { id: "1", role: "admin", email: "a@b.com" };
    userStore.setUser(user);
    expect(userStore.getUser()).toEqual(user);
  });

  test("setUser with a falsy value normalizes to null", () => {
    userStore.setUser(null);
    expect(userStore.getUser()).toBeNull();
  });

  test("clearUser resets to null", () => {
    userStore.setUser({ id: "1" });
    userStore.clearUser();
    expect(userStore.getUser()).toBeNull();
  });
});
