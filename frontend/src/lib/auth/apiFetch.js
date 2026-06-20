// lib/auth/apiFetch.js
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

let refreshPromise = null;

async function refreshSession(serverCookieHeader = null) {
  if (!refreshPromise) {
    const headers = new Headers({
      "content-type": "application/json",
    });

    // Pass the server cookie along to the refresh request if we have it
    if (serverCookieHeader) {
      headers.set("cookie", serverCookieHeader);
    }

    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers,
    })
      .then((res) => res.ok)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function shouldSkipRefresh(url) {
  return url.includes("/auth/refresh") || url.includes("/login");
}

export async function apiFetch(input, init) {
  const urlString = input.toString();
  const fullUrl = urlString.startsWith("http")
    ? urlString
    : `${API_BASE_URL}${urlString.startsWith("/") ? "" : "/"}${urlString}`;

  const request = new Request(fullUrl, {
    ...init,
    credentials: init?.credentials ?? "include",
  });

  // Extract the cookie from the init headers if a Server Component passed it in
  let serverCookieHeader = null;
  const initHeaders = new Headers(init?.headers);
  if (initHeaders.has("cookie")) {
    serverCookieHeader = initHeaders.get("cookie");
  }

  const firstResponse = await fetch(request.clone());

  if (
    firstResponse.status !== 401 ||
    init?.retryOnUnauthorized === false ||
    shouldSkipRefresh(request.url)
  ) {
    return firstResponse;
  }

  const refreshed = await refreshSession(serverCookieHeader);
  if (!refreshed) {
    return firstResponse;
  }

  return fetch(request.clone());
}