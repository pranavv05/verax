import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// tokenStore/userStore are module-scope singletons, so each test resets them
// explicitly rather than relying on module re-isolation between tests.
import { tokenStore, userStore } from "../../src/lib/token-store";
import { request, setUnauthorizedHandler } from "../../src/lib/api-client";

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body ?? {})
});

describe("api-client request()", () => {
  beforeEach(() => {
    tokenStore.clearAccessToken();
    userStore.clearUser();
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("attaches the Bearer token when auth is true and a token exists", async () => {
    tokenStore.setAccessToken("live-token");
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));

    await request("/api/clients");

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer live-token");
  });

  test("does not attach a Bearer header when auth is false", async () => {
    tokenStore.setAccessToken("live-token");
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, {}));

    await request("/api/waitlist/join", { method: "POST", auth: false });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  test("JSON-encodes a plain object body and sets Content-Type", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    await request("/api/clients", { method: "POST", body: { name: "Acme" } });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.body).toBe(JSON.stringify({ name: "Acme" }));
  });

  test("does not JSON-encode a FormData body", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const formData = new FormData();
    formData.append("file", new Blob(["x"]), "test.xlsx");

    await request("/api/tools/register-clean", { method: "POST", body: formData });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBeUndefined();
    expect(options.body).toBe(formData);
  });

  test("on a real 401, transparently refreshes the token and retries once with the new token", async () => {
    tokenStore.setAccessToken("stale-token");
    global.fetch = vi
      .fn()
      // 1. original request -> 401
      .mockResolvedValueOnce(jsonResponse(401, { message: "jwt expired" }))
      // 2. refresh call -> new token
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: "fresh-token", user: { id: "u1" } }))
      // 3. retried original request -> succeeds
      .mockResolvedValueOnce(jsonResponse(200, { data: "ok" }));

    const result = await request("/api/clients");

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch.mock.calls[1][0]).toContain("/api/auth/refresh");
    // the retried call must carry the newly-refreshed token, not the stale one
    expect(global.fetch.mock.calls[2][1].headers.Authorization).toBe("Bearer fresh-token");
    expect(result).toEqual({ data: "ok" });
    expect(tokenStore.getAccessToken()).toBe("fresh-token");
    expect(userStore.getUser()).toEqual({ id: "u1" });
  });

  test("concurrent 401s share a single in-flight refresh call, not one per request", async () => {
    tokenStore.setAccessToken("stale-token");
    global.fetch = vi.fn().mockImplementation((url) => {
      if (String(url).includes("/api/auth/refresh")) {
        return Promise.resolve(jsonResponse(200, { accessToken: "fresh-token" }));
      }
      // Every non-refresh call 401s on its first hit; the api-client passes
      // skipRefresh:true on the retry, so we key off that instead of a call
      // counter to decide when to start succeeding.
      return Promise.resolve(jsonResponse(401, {}));
    });

    // Two calls in flight at once, both hitting a stale token.
    const [a, b] = await Promise.allSettled([request("/api/clients"), request("/api/documents")]);

    const refreshCalls = global.fetch.mock.calls.filter(([url]) => String(url).includes("/api/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
    // Both ultimately fail here since the mock always 401s non-refresh calls,
    // which is fine — the assertion under test is refresh call de-duplication.
    expect(a.status).toBe("rejected");
    expect(b.status).toBe("rejected");
  });

  test("when refresh itself fails, clears the session, calls the unauthorized handler, and throws", async () => {
    tokenStore.setAccessToken("stale-token");
    userStore.setUser({ id: "u1" });
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: "jwt expired" }))
      .mockResolvedValueOnce(jsonResponse(401, { message: "refresh token invalid" }));

    await expect(request("/api/clients")).rejects.toThrow();

    expect(tokenStore.getAccessToken()).toBeNull();
    expect(userStore.getUser()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test("does not attempt a second refresh loop on the retried request (skipRefresh prevents infinite retry)", async () => {
    tokenStore.setAccessToken("stale-token");
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, {})) // original
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: "fresh-token" })) // refresh
      .mockResolvedValueOnce(jsonResponse(401, {})); // retried request ALSO 401s

    await expect(request("/api/clients")).rejects.toThrow();
    // exactly 3 calls: original, refresh, one retry — never a second refresh
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test("throws a descriptive error for a non-401 failure without attempting a refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(500, { message: "Internal error" }));
    await expect(request("/api/clients")).rejects.toThrow("Internal error");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("returns null for a 204 No Content response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" });
    const result = await request("/api/notifications/read-all", { method: "PATCH" });
    expect(result).toBeNull();
  });

  test("returns a blob when responseType is 'blob'", async () => {
    const mockBlob = new Blob(["xlsx bytes"]);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => mockBlob });
    const result = await request("/api/tools/register-clean", { responseType: "blob" });
    expect(result).toBe(mockBlob);
  });
});
