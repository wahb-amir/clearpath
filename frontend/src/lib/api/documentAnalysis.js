"use client";

import { fetchEventSource } from "@microsoft/fetch-event-source";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");

if (!API_BASE_URL) {
  console.warn("NEXT_PUBLIC_BACKEND_URL is not set");
}


let refreshPromise= null;

function resolveUrl(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (!API_BASE_URL) return pathOrUrl;
  return `${API_BASE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function shouldSkipRefresh(url) {
  return (
    url.includes("/auth/refresh") ||
    url.includes("/login")
  );
}

export async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(resolveUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
      },
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function apiFetch(
  input,
  init
) {
  const {
    retryOnUnauthorized = true,
    credentials,
    ...rest
  } = init;

  const request = new Request(input, {
    ...rest,
    credentials: credentials ?? "include",
  });

  const firstResponse = await fetch(request.clone());

  if (
    firstResponse.status !== 401 ||
    !retryOnUnauthorized ||
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

async function readErrorMessage(res) {
  try {
    const data = await res.json();
    return data?.error || data?.message || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function startAnalysisRequest(params) {
  const {
    documentId,
    purpose = "full_analysis",
    analysisVersion = "v1",
  } = params;

  const res = await apiFetch(
    resolveUrl(`/documents/${documentId}/analyze`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ purpose, analysisVersion }),
    }
  );

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  return res.json();
}

export async function openAnalysisStream(params) {
  const { sseUrl, onMessage, onError, signal, lastEventId } = params;

  const headers = lastEventId
    ? { "Last-Event-ID": lastEventId }
    : {};

  return fetchEventSource(resolveUrl(sseUrl), {
    method: "GET",
    credentials: "include",
    headers,
    signal,
    openWhenHidden: true,

    onopen: async (res) => {
      if (res.status === 401) {
        const refreshed = await refreshSession();
        if (refreshed) {
          throw new Error("Session refreshed, reconnecting SSE");
        }
        throw new Error(`SSE unauthorized (${res.status})`);
      }

      if (!res.ok) {
        throw new Error(`SSE connection failed (${res.status})`);
      }
    },

    onmessage: (msg) => {
      if (!msg.event || msg.event === "heartbeat") return;

      let parsed;
      try {
        parsed = JSON.parse(msg.data);
      } catch {
        return;
      }

      onMessage(
        msg.event,
        parsed,
        msg.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
    },

    onerror: (err) => {
      onError?.(err);
      throw err;
    },
  });
}