// lib/apiFetch.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'; // <-- Point to your Express port

let refreshPromise = null;

async function refreshSession() {
  if (!refreshPromise) {
    // Note: Make sure your auth refresh endpoint is either on Next.js or the backend.
    // If it's on the backend, this needs to be `${API_BASE_URL}/api/auth/refresh`
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
      },
    })
      .then((res) => res.ok)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function shouldSkipRefresh(url) {
  return url.includes('/auth/refresh') || url.includes('/login');
}

export async function apiFetch(input, init) {
  // 1. Ensure we construct the full backend URL if a relative path is passed
  const urlString = input.toString();
  const fullUrl = urlString.startsWith('http') 
    ? urlString 
    : `${API_BASE_URL}${urlString.startsWith('/') ? '' : '/'}${urlString}`;

  const request = new Request(fullUrl, {
    ...init,
    credentials: init?.credentials ?? 'include', // Needed for cookies across ports
  });

  const firstResponse = await fetch(request.clone());

  if (
    firstResponse.status !== 401 ||
    init?.retryOnUnauthorized === false || // Note: Added type safety if using TS
    shouldSkipRefresh(request.url)
  ) {
    return firstResponse;
  }

  const refreshed = await refreshSession();
  if (!refreshed) {
    return firstResponse;
  }

  return fetch(request.clone());
}