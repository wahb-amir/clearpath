// lib/apiFetch.ts
let refreshPromise = null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', {
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
  return url.includes('/api/auth/refresh') || url.includes('/login');
}

export async function apiFetch(
  input,
  init
) {
  const request = new Request(input, {
    ...init,
    credentials: init.credentials ?? 'include',
  });

  const firstResponse = await fetch(request.clone());

  if (
    firstResponse.status !== 401 ||
    init.retryOnUnauthorized === false ||
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