import { tokenStore, userStore } from "./token-store";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

let refreshPromise = null;
let unauthorizedHandler = null;

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

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include"
      });

      const payload = await parseJsonSafely(response);
      if (!response.ok || !payload?.accessToken) {
        throw toApiError(response.status, payload);
      }

      tokenStore.setAccessToken(payload.accessToken);
      if (payload.user) {
        userStore.setUser(payload.user);
      }
      return payload.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

const handleUnauthorized = () => {
  tokenStore.clearAccessToken();
  userStore.clearUser();
  if (typeof unauthorizedHandler === "function") {
    unauthorizedHandler();
  }
};

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

export const request = async (
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
    const token = tokenStore.getAccessToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  let payloadBody = body;
  if (body && !(body instanceof FormData) && !requestHeaders["Content-Type"]) {
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
      await refreshAccessToken();
      return request(path, {
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

export { API_BASE_URL, refreshAccessToken };
