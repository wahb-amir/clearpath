"use client";

import { fetchEventSource } from "@microsoft/fetch-event-source";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");

if (!API_BASE_URL) {
  // Helps during local dev if env is missing
  console.warn("NEXT_PUBLIC_BACKEND_URL is not set");
}

function resolveUrl(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (!API_BASE_URL) return pathOrUrl;
  return `${API_BASE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
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
  const { documentId, purpose = "full_analysis", analysisVersion = "v1" } = params;

  const res = await fetch(resolveUrl(`/documents/${documentId}/analyze`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ purpose, analysisVersion }),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  return (await res.json()) ;
}

export async function openAnalysisStream(params) {
  const { sseUrl, onMessage, onError, signal, lastEventId } = params;

  const headers = {};
  if (lastEventId) headers["Last-Event-ID"] = lastEventId;

  return fetchEventSource(resolveUrl(sseUrl), {
    method: "GET",
    credentials: "include",
    headers,
    signal,
    openWhenHidden: true,
    onopen: async (res) => {
      if (!res.ok) {
        throw new Error(`SSE connection failed (${res.status})`);
      }
    },
    onmessage: (msg) => {
      if (!msg.event || msg.event === "heartbeat") return;

      let parsed
      try {
        parsed = JSON.parse(msg.data)
      } catch {
        return;
      }

      onMessage(msg.event , parsed, msg.id || `${Date.now()}-${Math.random()}`);
    },
    onerror: (err) => {
      onError?.(err);
      throw err;
    },
  });
}