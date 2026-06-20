import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

let refreshPromise = null;


async function refreshSession(serverCookieHeader= null) {
  if (!refreshPromise) {
    const headers = new Headers({
      "content-type": "application/json",
    });

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

export async function apiFetch(input,init) {
  const urlString = input.toString();
  const fullUrl = urlString.startsWith("http")
    ? urlString
    : `${API_BASE_URL}${urlString.startsWith("/") ? "" : "/"}${urlString}`;

  const headers = new Headers(init?.headers);
  let serverCookieHeader= null;

  const isServer = typeof window === "undefined";
  if (isServer) {
    try {
      const cookieStore = await cookies(); 
      
      serverCookieHeader = cookieStore
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

      if (serverCookieHeader) {
        headers.set("cookie", serverCookieHeader);
      }
    } catch (e) {
      // Fails silently during static site generation where cookies aren't available
    }
  }

  const request = new Request(fullUrl, {
    ...init,
    headers,
    credentials: init?.credentials ?? "include",
  });

  const firstResponse = await fetch(request.clone());

  if (
    firstResponse.status !== 401 ||
    // @ts-ignore - custom init property
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