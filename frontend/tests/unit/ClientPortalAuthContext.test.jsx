import { describe, test, expect, vi, afterEach } from "vitest";
import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";

import { ClientPortalAuthProvider, useClientPortalAuth } from "../../src/contexts/ClientPortalAuthContext";
import { clientTokenStore } from "../../src/lib/client-portal-client";

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body ?? {})
});

const Probe = () => {
  const { isLoading, isAuthenticated, clientName } = useClientPortalAuth();
  if (isLoading) return <p>loading</p>;
  return <p>{isAuthenticated ? `signed in as ${clientName}` : "signed out"}</p>;
};

describe("ClientPortalAuthProvider bootstrap", () => {
  afterEach(() => {
    clientTokenStore.clearAccessToken();
    vi.restoreAllMocks();
  });

  // The backend treats a second refresh with the same cookie as a replayed
  // token and revokes the session, so StrictMode's double-mounted effect used
  // to sign the client out on every page reload.
  test("sends one refresh request even when the effect runs twice", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, { accessToken: "token-1", client: { name: "Kumar & Sons" } }));

    render(
      <StrictMode>
        <ClientPortalAuthProvider>
          <Probe />
        </ClientPortalAuthProvider>
      </StrictMode>
    );

    await waitFor(() => expect(screen.getByText("signed in as Kumar & Sons")).toBeInTheDocument());
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
  });
});
