import { afterEach, describe, expect, test, vi } from "vitest";
import { refreshSession } from "../../src/lib/api-client";

describe("refreshSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("simultaneous refreshes share one request, so the rotating token is never presented twice", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ accessToken: "new-token", user: { id: "u1" } })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([refreshSession(), refreshSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.accessToken).toBe("new-token");
    expect(second).toBe(first);
  });

  test("a later refresh, after the first has finished, makes a fresh request", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ accessToken: "t" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await refreshSession();
    await refreshSession();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
