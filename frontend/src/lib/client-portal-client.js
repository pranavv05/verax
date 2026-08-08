/**
 * HTTP client for the client portal.
 *
 * Deliberately a separate module from `lib/api-client.js` with its own
 * module-scope token: the client portal's access token must never land in the
 * firm portal's tokenStore (or vice versa), and a 401 on one side must never
 * refresh the other. It talks only to /api/client-portal/*.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

let clientAccessToken = null;
let refreshPromise = null;
let unauthorizedHandler = null;

export const clientTokenStore = {
  getAccessToken() {
    return clientAccessToken;
  },
  setAccessToken(token) {
    clientAccessToken = token || null;
  },
  clearAccessToken() {
    clientAccessToken = null;
  }
};

export const setClientUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

const parseJsonSafely = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const toApiError = (status, payload) => {
  const message = payload?.message || payload?.error || "Request failed";
  const error = new Error(message);
  error.statusCode = status;
  error.payload = payload;
  return error;
};

export const refreshClientAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/api/client-portal/auth/refresh`, {
        method: "POST",
        credentials: "include"
      });

      const payload = await parseJsonSafely(response);
      if (!response.ok || !payload?.accessToken) {
        throw toApiError(response.status, payload);
      }

      clientTokenStore.setAccessToken(payload.accessToken);
      return payload;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

const handleUnauthorized = () => {
  clientTokenStore.clearAccessToken();
  if (typeof unauthorizedHandler === "function") {
    unauthorizedHandler();
  }
};

export const clientRequest = async (
  path,
  {
    method = "GET",
    body,
    headers = {},
    auth = true,
    skipRefresh = false,
    responseType = "json"
  } = {}
) => {
  const requestHeaders = { ...headers };

  if (auth) {
    const token = clientTokenStore.getAccessToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  let payloadBody = body;
  if (body && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
    payloadBody = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: payloadBody,
    credentials: "include"
  });

  if (response.status === 401 && auth && !skipRefresh) {
    const errorPayload = await parseJsonSafely(response);
    try {
      await refreshClientAccessToken();
      return clientRequest(path, {
        method,
        body,
        headers,
        auth,
        skipRefresh: true,
        responseType
      });
    } catch {
      handleUnauthorized();
      throw toApiError(401, errorPayload || { message: "Session expired" });
    }
  }

  if (!response.ok) {
    const errorPayload = await parseJsonSafely(response);
    throw toApiError(response.status, errorPayload);
  }

  if (response.status === 204) {
    return null;
  }

  if (responseType === "blob") {
    return response.blob();
  }

  return parseJsonSafely(response);
};

export { API_BASE_URL };
