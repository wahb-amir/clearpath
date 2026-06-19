"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import useSWR from "swr";
import {
  Upload,
  FileStack,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  Loader2,
  FileText,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { useIsMobile } from "@/lib/useIsMobile";
import {
  openAnalysisStream,
  startAnalysisRequest,
  fetchExtractedContent,
  confirmExtraction,
} from "@/lib/api/documentAnalysis";
import ExtractionVerificationPanel from "../document-intelligence/ExtractionVerificationPanel";
import { apiFetch } from "@/lib/auth/apiFetch";
import {
  EVENT_LABELS,
  MAX_UPLOAD_BYTES,
  stageToProgress,
  isAcceptedDocumentFile,
} from "../document-intelligence/constants";
import FileUploadDropzone from "../document-intelligence/FileUploadDropzone";

const ScanAnimation = dynamic(() => import("@/components/3d/ScanAnimation"), {
  ssr: false,
});

const ACTIVE_SESSION_KEY = "document-intelligence:active-session";

function safeReadSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeWriteSession(session) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore storage failures
  }
}

function safeClearSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // ignore storage failures
  }
}

function formatStageText(stage) {
  if (!stage) return "Idle";
  return stage
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function normalizeStage(stage) {
  return stage || "IDLE";
}

async function uploadDocumentFile(file) {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";

  const signResponse = await apiFetch(`${baseUrl}/uploads/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }),
  });

  if (!signResponse.ok) {
    let message = "Upload signing failed";
    try {
      const data = await signResponse.json();
      message = data?.message || data?.error || message;
    } catch {
      const text = await signResponse.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  const { documentId, uploadSessionId, path, uploadToken } =
    await signResponse.json();

  const { supabaseBrowser: supabase } =
    await import("@/lib/supabase/browser-client");

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .uploadToSignedUrl(path, uploadToken, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    await apiFetch(`${baseUrl}/uploads/fail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId,
        uploadSessionId,
        reason: uploadError.message,
      }),
    });

    throw uploadError;
  }

  const completeResponse = await apiFetch(`${baseUrl}/uploads/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId,
      uploadSessionId,
    }),
  });

  if (!completeResponse.ok) {
    let message = "Upload completion failed";
    try {
      const data = await completeResponse.json();
      message = data?.message || data?.error || message;
    } catch {
      const text = await completeResponse.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  return await completeResponse.json();
}

function TimelineItem({ item, active }) {
  const icon =
    item.stage === "FAILED" ? (
      <AlertCircle size={14} />
    ) : item.stage === "COMPLETED" ? (
      <CheckCircle2 size={14} />
    ) : item.stage === "RUNNING" ||
      item.stage === "PROCESSING" ||
      item.stage === "CHUNKING" ? (
      <Loader2 size={14} className="animate-spin" />
    ) : (
      <Sparkles size={14} />
    );

  const isWorking =
    active && item.stage !== "FAILED" && item.stage !== "COMPLETED";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`relative overflow-hidden rounded-2xl border transition-colors duration-300 ${
        active
          ? "border-cyan-500/30 bg-[#0B0D10]"
          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
      } p-4`}
    >
      {isWorking && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/5"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {active && (
        <motion.div
          layoutId="active-accent"
          className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-400 to-blue-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
        />
      )}

      <div className="relative z-10 flex items-start justify-between gap-4 pl-1">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
              item.stage === "FAILED"
                ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
                : item.stage === "COMPLETED"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : active
                    ? "border-cyan-500/30 bg-cyan-500/20 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                    : "border-blue-500/20 bg-blue-500/10 text-blue-300"
            }`}
          >
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-semibold text-white">
              {item.label || EVENT_LABELS[item.name] || item.name}
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-gray-400">
              {item.message || "Updated"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
          <span className="text-[11px] font-medium tracking-wider text-gray-500">
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          <span
            title={item.stage}
            className={`max-w-[110px] sm:max-w-[160px] truncate rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider ${
              active
                ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-400"
                : "border-white/10 bg-white/5 text-gray-400"
            }`}
          >
            {formatStageText(item.stage)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function StatusCard({
  message,
  statusMeta,
  progress,
  progressFillClass,
  stage,
  completed,
  failed,
  reconnecting,
  isConnected,
  timeline,
  latestEventId,
  analysisRequestId,
  workerId,
  error,
  onRetry,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [timeline]);

  return (
    <div className="mt-5 rounded-[24px] border border-[#2B303B] bg-[#0B0D10]/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${
              completed
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                : failed
                  ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
                  : reconnecting
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                    : isConnected
                      ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                      : "border-white/10 bg-white/5 text-gray-300"
            }`}
          >
            {completed ? (
              <CheckCircle2 size={20} />
            ) : failed ? (
              <AlertCircle size={20} />
            ) : reconnecting ? (
              <WifiOff size={20} />
            ) : isConnected ? (
              <Wifi size={20} />
            ) : (
              <Sparkles size={20} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-white max-w-[200px] sm:max-w-none">
                {message}
              </h3>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide shrink-0 ${
                  statusMeta.tone === "success"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                    : statusMeta.tone === "danger"
                      ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
                      : statusMeta.tone === "warning"
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                        : statusMeta.tone === "live"
                          ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                          : "border-white/10 bg-white/5 text-gray-300"
                }`}
              >
                {statusMeta.text}
              </span>
            </div>

            <p className="mt-1 truncate text-xs text-gray-500">
              {stage === "COMPLETED"
                ? "Analysis finished and ready to review."
                : stage === "FAILED"
                  ? "The upload or analysis stopped. You can retry with a fresh file."
                  : "Live events are streamed here as they arrive."}
            </p>
          </div>
        </div>

        {(completed || failed) && (
          <button
            type="button"
            onClick={onRetry}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all shrink-0 ${
              failed
                ? "border-rose-500/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15"
                : "border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
            }`}
          >
            <RefreshCw size={14} />
            {failed ? "Retry upload" : "Analyze another file"}
          </button>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-[11px] text-gray-500">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className={`h-full rounded-full ${progressFillClass}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            Stage
          </div>
          <div
            title={stage}
            className="mt-1 truncate text-sm font-medium text-white"
          >
            {formatStageText(stage)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            Request
          </div>
          <div className="mt-1 truncate text-sm font-medium text-white">
            {analysisRequestId || "Waiting..."}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            Worker
          </div>
          <div className="mt-1 truncate text-sm font-medium text-white">
            {workerId || "Waiting..."}
          </div>
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="mt-4 rounded-2xl border border-rose-500/15 bg-rose-500/10 p-3 text-sm text-rose-100 break-words"
          >
            {error}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mt-6 border-t border-white/5 pt-5">
        <div className="mb-4 flex items-center justify-between px-1">
          <h4 className="text-sm font-semibold text-white">
            Live event stream
          </h4>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-gray-400">
            {timeline.length} event{timeline.length === 1 ? "" : "s"}
          </span>
        </div>

        <div
          ref={scrollRef}
          className="custom-scrollbar max-h-[280px] space-y-3 overflow-y-auto pr-2 pb-2"
        >
          <AnimatePresence initial={false} mode="popLayout">
            {timeline.map((item) => (
              <TimelineItem
                key={item.eventId}
                item={item}
                active={item.eventId === latestEventId}
              />
            ))}
            {timeline.length === 0 && !isConnected && !completed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-8 text-center text-sm text-gray-500"
              >
                Waiting for analysis to begin...
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function DocumentIntelligencePanel({
  onAnalyze,
  onAiResult,
  analyzing = false,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState("IDLE");
  const [message, setMessage] = useState("Ready to analyze");
  const [progress, setProgress] = useState(0);
  const [workerId, setWorkerId] = useState(null);
  const [analysisRequestId, setAnalysisRequestId] = useState(null);
  const [extractedContent, setExtractedContent] = useState(null);
  const [error, setError] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [latestEventId, setLatestEventId] = useState(null);
  const [filePickerKey, setFilePickerKey] = useState(0);

  const abortRef = useRef(null);
  const seenEventIdsRef = useRef(new Set());
  const lastEventIdRef = useRef(null);
  const sessionMetaRef = useRef({
    documentId: null,
    fileName: null,
    sseUrl: null,
    analysisRequestId: null,
    lastEventId: null,
  });
  const streamStateRef = useRef({
    documentId: null,
    sseUrl: null,
    status: "idle", // idle | connecting | live
  });
  const resumeLockRef = useRef(false);

  const isMobile = useIsMobile();

  const { data: runningCheck, mutate: refreshRunningCheck } = useSWR(
    "/analysis/running-check",
    async (url) => {
      const res = await apiFetch(url);
      if (!res.ok) return { running: false, document: null };
      return res.json();
    },
    {
      revalidateOnFocus: true,
      revalidateOnMount: true,
      shouldRetryOnError: false,
    },
  );

  const serverRunning = Boolean(runningCheck?.running);
  const serverDocument = runningCheck?.document ?? null;
  const serverDocumentId = serverDocument?.id ?? null;
  const serverFileName = serverDocument?.fileName ?? null;
  const serverStage = normalizeStage(serverDocument?.analysisStatus);

  useEffect(() => {
    if (
      stage === "AWAITING_VERIFICATION" &&
      !extractedContent &&
      (activeSession?.documentId || serverDocumentId)
    ) {
      const docId = activeSession?.documentId || serverDocumentId;
      if (docId) {
        fetchExtractedContent(docId)
          .then((data) => {
            if (data && data.extracted_content) {
              setExtractedContent(data.extracted_content);
            }
          })
          .catch((err) =>
            console.error("Failed to fetch extracted content", err),
          );
      }
    }
  }, [stage, extractedContent, activeSession?.documentId, serverDocumentId]);

  const busy = Boolean(analyzing || isAnalyzing || serverRunning);
  const isFileBusy = busy && !completed && !failed;

  const persistSession = useCallback((patch) => {
    const next = {
      ...sessionMetaRef.current,
      ...patch,
    };
    sessionMetaRef.current = next;
    setActiveSession({
      documentId: next.documentId,
      fileName: next.fileName,
      sseUrl: next.sseUrl,
      analysisRequestId: next.analysisRequestId,
      lastEventId: next.lastEventId ?? null,
    });
    safeWriteSession(next);
  }, []);

  const clearRuntimeState = useCallback(
    ({ clearFile = false } = {}) => {
      abortRef.current?.abort();
      streamStateRef.current = {
        documentId: null,
        sseUrl: null,
        status: "idle",
      };
      resumeLockRef.current = false;

      setError(null);
      setFailed(false);
      setCompleted(false);
      setIsAnalyzing(false);
      setIsConnected(false);
      setReconnecting(false);
      setStage("IDLE");
      setMessage("Ready to analyze");
      setProgress(0);
      setWorkerId(null);
      setAnalysisRequestId(null);
      setTimeline([]);
      setLatestEventId(null);
      onAiResult?.(null);

      seenEventIdsRef.current = new Set();
      lastEventIdRef.current = null;

      if (clearFile) setSelectedFile(null);
    },
    [onAiResult],
  );

  const clearSession = useCallback(
    ({ clearFile = false } = {}) => {
      clearRuntimeState({ clearFile });
      sessionMetaRef.current = {
        documentId: null,
        fileName: null,
        sseUrl: null,
        analysisRequestId: null,
        lastEventId: null,
      };
      setActiveSession(null);
      safeClearSession();
    },
    [clearRuntimeState],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const statusMeta = completed
    ? { text: "Completed", tone: "success" }
    : failed
      ? { text: "Failed", tone: "danger" }
      : reconnecting
        ? { text: "Reconnecting", tone: "warning" }
        : isConnected
          ? { text: "Live", tone: "live" }
          : { text: "Idle", tone: "neutral" };

  const progressFillClass = failed
    ? "bg-gradient-to-r from-rose-500 to-rose-400"
    : completed
      ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
      : "bg-gradient-to-r from-cyan-500 to-blue-500";

  const currentDocument = selectedFile
    ? {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type || "Unknown type",
      }
    : activeSession?.fileName
      ? {
          name: activeSession.fileName,
          size: null,
          type: "Recovered session",
        }
      : null;

  const isVirtualSession = Boolean(activeSession && !selectedFile);

  const syncStream = useCallback(
    async ({ reason = "resume" } = {}) => {
      const stored = safeReadSession();
      const session =
        stored && stored.documentId
          ? stored
          : sessionMetaRef.current.documentId
            ? sessionMetaRef.current
            : null;

      const activeDocId = serverDocumentId || session?.documentId;
      const activeFileName = serverFileName || session?.fileName || null;
      const activeSseUrl = session?.sseUrl || serverDocument?.sseUrl || null;

      if (!serverRunning && !session && !isAnalyzing) {
        return;
      }

      if (
        resumeLockRef.current &&
        streamStateRef.current.documentId === activeDocId
      ) {
        return;
      }

      if (!activeDocId) return;
      if (!activeSseUrl) return;

      const alreadyLive =
        streamStateRef.current.documentId === activeDocId &&
        streamStateRef.current.sseUrl === activeSseUrl &&
        streamStateRef.current.status === "live";

      const alreadyConnecting =
        streamStateRef.current.documentId === activeDocId &&
        streamStateRef.current.sseUrl === activeSseUrl &&
        streamStateRef.current.status === "connecting";

      if (alreadyLive || alreadyConnecting) return;

      resumeLockRef.current = true;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      streamStateRef.current = {
        documentId: activeDocId,
        sseUrl: activeSseUrl,
        status: "connecting",
      };

      const lastEventId =
        session?.lastEventId || lastEventIdRef.current || null;

      setError(null);
      setFailed(false);
      setCompleted(false);
      setIsAnalyzing(true);
      setIsConnected(false);
      setReconnecting(true);
      setStage(normalizeStage(serverStage || session?.stage || "RUNNING"));
      setMessage(
        reason === "focus"
          ? "Tab focused. Reconnecting live analysis..."
          : activeSession
            ? "Resuming live analysis..."
            : "Restoring active analysis...",
      );
      setProgress(stageToProgress(serverStage || session?.stage || "RUNNING"));
      setAnalysisRequestId(session?.analysisRequestId ?? null);
      setWorkerId(session?.workerId ?? null);
      setActiveSession((prev) =>
        prev && prev.documentId === activeDocId
          ? prev
          : {
              documentId: activeDocId,
              fileName: activeFileName,
              sseUrl: activeSseUrl,
              analysisRequestId: session?.analysisRequestId ?? null,
              lastEventId: lastEventId,
            },
      );

      const applyEvent = (eventName, data, eventId) => {
        if (seenEventIdsRef.current.has(eventId)) return;
        seenEventIdsRef.current.add(eventId);
        lastEventIdRef.current = eventId;

        const nextStage = normalizeStage(data.stage);
        setStage(nextStage);
        setMessage(data.message || "Updated");
        setProgress(
          typeof data.progress === "number"
            ? data.progress
            : stageToProgress(nextStage),
        );
        setIsConnected(true);
        setReconnecting(false);
        setLatestEventId(eventId);
        streamStateRef.current = {
          documentId: activeDocId,
          sseUrl: activeSseUrl,
          status: "live",
        };

        persistSession({
          documentId: activeDocId,
          fileName: activeFileName,
          sseUrl: activeSseUrl,
          analysisRequestId: session?.analysisRequestId ?? null,
          lastEventId: eventId,
          stage: nextStage,
        });

        if (data.payload && typeof data.payload.workerId === "string") {
          setWorkerId(data.payload.workerId);
        }

        if (
          (eventName === "ai_completed" ||
            eventName === "analysis_completed") &&
          data.payload &&
          typeof data.payload.summary === "string"
        ) {
          onAiResult?.({
            summary: data.payload.summary,
            actionItems: data.payload.actionItems ?? [],
            keyDeadlines: data.payload.keyDeadlines ?? [],
            questionsToAsk: data.payload.questionsToAsk ?? [],
            aiConfidence: data.payload.aiConfidence ?? null,
            trustedSources: data.payload.trustedSources ?? [],
            humanReview: data.payload.humanReview ?? null,
            status: data.payload.status ?? null,
          });
        }

        if (nextStage === "COMPLETED") {
          setCompleted(true);
          setIsAnalyzing(false);
          setIsConnected(false);
          setReconnecting(false);
          safeClearSession();
        }

        if (nextStage === "FAILED") {
          setFailed(true);
          setIsAnalyzing(false);
          setIsConnected(false);
          setReconnecting(false);
          setError(
            typeof data.payload?.error === "string"
              ? data.payload.error
              : "Analysis failed",
          );
          safeClearSession();
        }

        setTimeline((prev) => {
          if (prev.some((x) => x.eventId === eventId)) return prev;
          return [
            ...prev,
            {
              eventId,
              name: eventName,
              label: EVENT_LABELS[eventName] ?? eventName,
              stage: nextStage,
              message: data.message,
              progress:
                typeof data.progress === "number"
                  ? data.progress
                  : stageToProgress(nextStage),
              payload: data.payload,
              createdAt: data.createdAt || new Date().toISOString(),
            },
          ];
        });
      };

      try {
        await openAnalysisStream({
          sseUrl: activeSseUrl,
          signal: controller.signal,
          lastEventId,
          onMessage: (eventName, data, eventId) => {
            applyEvent(eventName, data, eventId);
          },
          onError: (err) => {
            if (controller.signal.aborted) return;
            setIsConnected(false);
            setReconnecting(true);
            setError(
              err instanceof Error ? err.message : "Connection interrupted",
            );
          },
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setIsConnected(false);
        setReconnecting(true);
        setError(err instanceof Error ? err.message : "Connection error");
      } finally {
        resumeLockRef.current = false;
      }
    },
    [
      activeSession,
      isAnalyzing,
      onAiResult,
      persistSession,
      serverDocument?.sseUrl,
      serverDocumentId,
      serverFileName,
      serverRunning,
      serverStage,
    ],
  );

  useEffect(() => {
    if (!runningCheck) return;

    if (runningCheck.running) {
      void syncStream({ reason: "mount-or-refresh" });
      return;
    }

    // If the server says nothing is running and we only have a stale resume snapshot,
    // clear it after a short grace so a fresh upload can proceed normally.
    if (!busy && activeSession && !selectedFile) {
      safeClearSession();
      setActiveSession(null);
      sessionMetaRef.current = {
        documentId: null,
        fileName: null,
        sseUrl: null,
        analysisRequestId: null,
        lastEventId: null,
      };
      streamStateRef.current = {
        documentId: null,
        sseUrl: null,
        status: "idle",
      };
    }
  }, [activeSession, busy, runningCheck, selectedFile, syncStream]);

  useEffect(() => {
    const handleWake = () => {
      void refreshRunningCheck();
      if (document.visibilityState === "visible") {
        void syncStream({ reason: "focus" });
      }
    };

    window.addEventListener("focus", handleWake);
    document.addEventListener("visibilitychange", handleWake);

    return () => {
      window.removeEventListener("focus", handleWake);
      document.removeEventListener("visibilitychange", handleWake);
    };
  }, [refreshRunningCheck, syncStream]);

  const clearAnalysisState = useCallback(
    ({ clearFile = false } = {}) => {
      abortRef.current?.abort();
      streamStateRef.current = {
        documentId: null,
        sseUrl: null,
        status: "idle",
      };
      resumeLockRef.current = false;

      setError(null);
      setFailed(false);
      setCompleted(false);
      setIsAnalyzing(false);
      setIsConnected(false);
      setReconnecting(false);
      setStage("IDLE");
      setMessage("Ready to analyze");
      setProgress(0);
      setWorkerId(null);
      setAnalysisRequestId(null);
      setTimeline([]);
      setLatestEventId(null);
      onAiResult?.(null);

      seenEventIdsRef.current = new Set();
      lastEventIdRef.current = null;

      if (clearFile) setSelectedFile(null);
    },
    [onAiResult],
  );

  const handleFileSelect = useCallback(
    (file) => {
      if (!file) return;

      if (!isAcceptedDocumentFile(file)) {
        clearAnalysisState();
        setError("Unsupported file type. Use PDF, DOC, DOCX, or TXT.");
        setFailed(true);
        return;
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        clearAnalysisState();
        setError("File too large. Maximum size is 50MB.");
        setFailed(true);
        return;
      }

      clearSession({ clearFile: false });
      setSelectedFile(file);
      setMessage(`Ready to upload ${file.name}`);
    },
    [clearAnalysisState, clearSession],
  );

  const handleClearFile = useCallback(() => {
    if (busy) return;
    clearSession({ clearFile: true });
    clearAnalysisState({ clearFile: true });
  }, [busy, clearAnalysisState, clearSession]);

  const handleRetry = useCallback(() => {
    if (busy) return;
    clearSession({ clearFile: true });
    clearAnalysisState({ clearFile: true });
  }, [busy, clearAnalysisState, clearSession]);

  const handleAnalyze = useCallback(async () => {
    if (!selectedFile) {
      setError("Choose a file first.");
      setFailed(true);
      return;
    }

    setError(null);
    setFailed(false);
    setCompleted(false);
    setTimeline([]);
    setMessage("Uploading document...");
    setProgress(0);
    setStage("QUEUED");
    setIsAnalyzing(true);
    setIsConnected(false);
    setReconnecting(false);
    setLatestEventId(null);
    onAiResult?.(null);
    seenEventIdsRef.current = new Set();
    lastEventIdRef.current = null;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const uploadResult = await uploadDocumentFile(selectedFile);
      const documentId =
        uploadResult?.documentId ||
        uploadResult?.id ||
        uploadResult?.document?.id;

      if (!documentId) {
        throw new Error("Upload succeeded, but no documentId was returned.");
      }

      setMessage("Upload complete. Starting analysis...");

      const response = await startAnalysisRequest({
        documentId,
        purpose: "full_analysis",
        analysisVersion: "v1",
      });

      setAnalysisRequestId(response.analysisRequestId);
      setWorkerId(response.workerId);
      setStage(normalizeStage(response.currentStatus));
      setMessage(
        response.deduplication?.isNewRequest
          ? "Analysis request created"
          : "Existing analysis request resumed",
      );
      setProgress(stageToProgress(response.currentStatus));

      const sseUrl = response.sseUrl || sessionMetaRef.current.sseUrl || null;
      persistSession({
        documentId,
        fileName: selectedFile.name,
        sseUrl,
        analysisRequestId: response.analysisRequestId ?? null,
        lastEventId: null,
      });

      onAnalyze?.(response);

      void openAnalysisStream({
        sseUrl,
        signal: controller.signal,
        lastEventId: null,
        onMessage: (eventName, data, eventId) => {
          if (seenEventIdsRef.current.has(eventId)) return;
          seenEventIdsRef.current.add(eventId);
          lastEventIdRef.current = eventId;

          const nextStage = normalizeStage(data.stage);
          setStage(nextStage);
          setMessage(data.message || "Updated");
          setProgress(
            typeof data.progress === "number"
              ? data.progress
              : stageToProgress(nextStage),
          );
          setIsConnected(true);
          setReconnecting(false);
          setLatestEventId(eventId);
          streamStateRef.current = {
            documentId,
            sseUrl,
            status: "live",
          };
          persistSession({
            documentId,
            fileName: selectedFile.name,
            sseUrl,
            analysisRequestId: response.analysisRequestId ?? null,
            lastEventId: eventId,
            stage: nextStage,
          });

          if (data.payload && typeof data.payload.workerId === "string") {
            setWorkerId(data.payload.workerId);
          }

          if (
            nextStage === "AWAITING_VERIFICATION" &&
            data.payload?.extractedContent
          ) {
            setExtractedContent(data.payload.extractedContent);
          }

          if (
            (eventName === "ai_completed" ||
              eventName === "analysis_completed") &&
            data.payload &&
            typeof data.payload.summary === "string"
          ) {
            onAiResult?.({
              summary: data.payload.summary,
              actionItems: data.payload.actionItems ?? [],
              keyDeadlines: data.payload.keyDeadlines ?? [],
              questionsToAsk: data.payload.questionsToAsk ?? [],
              aiConfidence: data.payload.aiConfidence ?? null,
              trustedSources: data.payload.trustedSources ?? [],
              humanReview: data.payload.humanReview ?? null,
              status: data.payload.status ?? null,
            });
          }

          if (nextStage === "COMPLETED") {
            setCompleted(true);
            setIsAnalyzing(false);
            setIsConnected(false);
            setReconnecting(false);
            safeClearSession();
          }

          if (nextStage === "FAILED") {
            setFailed(true);
            setIsAnalyzing(false);
            setIsConnected(false);
            setReconnecting(false);
            setError(
              typeof data.payload?.error === "string"
                ? data.payload.error
                : "Analysis failed",
            );
            safeClearSession();
          }

          setTimeline((prev) => {
            if (prev.some((x) => x.eventId === eventId)) return prev;
            return [
              ...prev,
              {
                eventId,
                name: eventName,
                label: EVENT_LABELS[eventName] ?? eventName,
                stage: nextStage,
                message: data.message,
                progress:
                  typeof data.progress === "number"
                    ? data.progress
                    : stageToProgress(nextStage),
                payload: data.payload,
                createdAt: data.createdAt || new Date().toISOString(),
              },
            ];
          });
        },
        onError: (err) => {
          if (controller.signal.aborted) return;
          setIsConnected(false);
          setReconnecting(true);
          setError(
            err instanceof Error ? err.message : "Connection interrupted",
          );
        },
      }).catch((err) => {
        if (controller.signal.aborted) return;
        setIsConnected(false);
        setReconnecting(true);
        setError(err instanceof Error ? err.message : "Connection error");
      });
    } catch (err) {
      setIsAnalyzing(false);
      setIsConnected(false);
      setReconnecting(false);
      setFailed(true);
      setError(err instanceof Error ? err.message : "Failed to start analysis");
    }
  }, [onAiResult, onAnalyze, persistSession, selectedFile]);

  const hasFile = Boolean(selectedFile || activeSession);
  const resumeHint = activeSession && !selectedFile;

  return (
    <div
      className="mx-auto w-full max-w-4xl font-sans text-gray-100"
      style={{ position: "sticky", top: "80px" }}
    >
      <div className="overflow-hidden rounded-[28px] border border-[#2B303B] bg-[linear-gradient(180deg,#141821_0%,#0B0D10_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="border-b border-white/6 px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-500/15 bg-cyan-500/10 text-cyan-300 shadow-inner shadow-cyan-500/10">
              <FileStack size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white sm:text-lg">
                Document Intelligence
              </h2>
              <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">
                Upload a file and track the live AI response as it streams in.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-7 sm:py-6">
          <AnimatePresence mode="wait" initial={false}>
            {!hasFile ? (
              <motion.div
                key={`dropzone-${filePickerKey}`}
                initial={{ opacity: 0, y: 16, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.975, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 360, damping: 32 }}
                className="rounded-[24px]"
              >
                <FileUploadDropzone
                  busy={busy}
                  isMobile={isMobile}
                  selectedFile={selectedFile}
                  onSelectFile={handleFileSelect}
                  onClearFile={handleClearFile}
                  ScanAnimation={ScanAnimation}
                />

                <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-gray-400">
                  Supported files: PDF, DOC, DOCX, TXT. Maximum size: 50MB.
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`file-${selectedFile?.name || activeSession?.fileName || "recovered"}`}
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <motion.div
                      layout
                      className={`grid h-14 w-14 place-items-center rounded-2xl border ${
                        completed
                          ? "border-emerald-500/15 bg-emerald-500/10 text-emerald-400"
                          : failed
                            ? "border-rose-500/15 bg-rose-500/10 text-rose-400"
                            : "border-cyan-500/15 bg-cyan-500/10 text-cyan-300"
                      }`}
                      animate={
                        isFileBusy
                          ? { scale: [1, 1.04, 1], rotate: [0, 2, 0] }
                          : { scale: 1, rotate: 0 }
                      }
                      transition={
                        isFileBusy
                          ? {
                              duration: 1.2,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }
                          : { duration: 0.2 }
                      }
                    >
                      {isFileBusy ? (
                        <Loader2 size={22} className="animate-spin" />
                      ) : completed ? (
                        <CheckCircle2 size={22} />
                      ) : failed ? (
                        <AlertCircle size={22} />
                      ) : (
                        <FileText size={22} />
                      )}
                    </motion.div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-white">
                          {currentDocument?.name || "Recovered analysis"}
                        </h3>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-gray-300">
                          {currentDocument?.size
                            ? formatBytes(currentDocument.size)
                            : resumeHint
                              ? "Session restored"
                              : "—"}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-gray-400">
                        {resumeHint
                          ? "An active analysis was restored from the server and local session cache."
                          : busy
                            ? "Your file is uploading and being analyzed."
                            : "File ready. Start analysis when you are ready."}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                        <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1">
                          {currentDocument?.type || "Unknown type"}
                        </span>
                        <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1">
                          {resumeHint
                            ? "Resuming SSE after refresh or focus"
                            : "Drag-drop replaced with a smooth file card"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!busy && (
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/10"
                      >
                        Change file
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={busy || !selectedFile}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        busy || !selectedFile
                          ? "cursor-not-allowed border border-cyan-500/15 bg-cyan-500/10 text-cyan-200/70"
                          : "border border-cyan-500/20 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/20"
                      }`}
                    >
                      {isFileBusy ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      {resumeHint
                        ? "Stream restored"
                        : isFileBusy
                          ? "Analyzing..."
                          : "Analyze file"}
                    </button>
                  </div>
                </div>

                <AnimatePresence mode="popLayout">
                  {failed && error ? (
                    <motion.div
                      key="file-error"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="mt-4 rounded-2xl border border-rose-500/15 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                    >
                      {error}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {stage === "AWAITING_VERIFICATION" ? (
            extractedContent ? (
              <div className="mt-4">
                <ExtractionVerificationPanel
                  documentId={activeSession?.documentId || serverDocumentId}
                  fileName={currentDocument?.name || "Document"}
                  extractedContent={extractedContent}
                  onConfirm={confirmExtraction}
                  onConfirmed={() => {
                    setStage("VERIFIED");
                    setMessage("Extraction confirmed. Continuing analysis...");
                  }}
                />
              </div>
            ) : (
              <div className="mt-8 flex justify-center p-12">
                <Loader2 className="animate-spin text-cyan-500" size={32} />
              </div>
            )
          ) : (
            <StatusCard
              message={message}
              statusMeta={statusMeta}
              progress={progress}
              progressFillClass={progressFillClass}
              stage={stage}
              completed={completed}
              failed={failed}
              reconnecting={reconnecting}
              isConnected={isConnected}
              timeline={timeline}
              latestEventId={latestEventId}
              analysisRequestId={analysisRequestId}
              workerId={workerId}
              error={error}
              onRetry={handleRetry}
            />
          )}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar {
              width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background-color: #2B303B;
              border-radius: 20px;
            }
            .custom-scrollbar:hover::-webkit-scrollbar-thumb {
              background-color: #3A4150;
            }
          `,
        }}
      />
    </div>
  );
}
