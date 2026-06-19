"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft, Terminal, Info, AlertOctagon } from "lucide-react";
import { apiFetch } from "@/lib/auth/apiFetch";
import ExtractionVerificationPanel from "@/components/document-intelligence/ExtractionVerificationPanel";
import {
  fetchExtractedContent,
  confirmExtraction,
  openAnalysisStream,
} from "@/lib/api/documentAnalysis";

// Direct imports of modular layout cards for pixel-perfect ResultsPanel parity
import SummaryCard from "@/components/results/SummaryCard";
import ChecklistCard from "@/components/results/ChecklistCard";
import DeadlinesCard from "@/components/results/DeadlinesCard";
import QuestionsCard from "@/components/results/QuestionsCard";
import ConfidenceCard from "@/components/results/ConfidenceCard";
import SourcesCard from "@/components/results/SourcesCard";

// Clean modular Skeleton component for easy re-use
function Skeleton({ className, ...props }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-800/50 ${className}`}
      {...props}
    />
  );
}

export default function RunDetailPage() {
  const { documentId } = useParams();
  const router = useRouter();

  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [extractedContent, setExtractedContent] = useState(null);
  const [fetchingExtractedContent, setFetchingExtractedContent] =
    useState(false);

  const terminalEndRef = useRef(null);

  // Anti-spam tracker registry holding active debounce timeouts for each item index
  const debounceTimersRef = useRef({});

  // Modular execution query fetcher
  const fetchRunDetail = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await apiFetch(`/analysis/runs/${documentId}`);
      if (!response.ok) {
        if (response.status === 404)
          throw new Error("Analysis run details could not be found.");
        throw new Error("Failed to load pipeline run parameters.");
      }
      const data = await response.json();
      setRun(data);
      if (data.events) {
        setEvents(data.events);
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRunDetail(true);

    return () => {
      // Clear any pending debounce micro-tasks on unmount to safeguard against memory leaks
      Object.values(debounceTimersRef.current).forEach(clearTimeout);
    };
  }, [documentId]);

  // Live SSE listener using robust openAnalysisStream utility
  useEffect(() => {
    if (!run || run.status !== "running") {
      return;
    }

    const abortController = new AbortController();

    openAnalysisStream({
      sseUrl: `documents/${documentId}/events`,
      signal: abortController.signal,
      onMessage: (eventName, data, eventId) => {
        try {
          const nextStage = data.stage;
          const newEvent = {
            id: eventId || Date.now(),
            stage: nextStage || run.currentStage || "PROCESSING",
            message: data.message || "Step complete.",
            createdAt: data.createdAt || new Date().toISOString(),
          };

          setEvents((prev) => {
            if (prev.some((x) => x.id === newEvent.id)) return prev;
            return [...prev, newEvent];
          });

          if (eventName === "extraction_draft_updated" && data.payload?.extractedContent) {
            setExtractedContent(data.payload.extractedContent);
          }

          // Update local run stages
          setRun((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              docAnalysisStatus: nextStage || prev.docAnalysisStatus,
              currentStage: nextStage || prev.currentStage,
            };
          });

          // Scroll terminal to latest trace
          terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });

          // Refresh detailed DB parameters when a phase changes to verification or terminal state
          if (
            nextStage === "COMPLETED" ||
            nextStage === "FAILED" ||
            nextStage === "AWAITING_VERIFICATION"
          ) {
            fetchRunDetail(false);
          }
        } catch (err) {
          console.error("Failed parsing inbound stream payload frame:", err);
        }
      },
      onError: (err) => {
        console.warn("SSE connection dropped frame stream channel:", err);
      },
    });

    return () => {
      abortController.abort();
    };
  }, [run?.status, documentId]);

  // Fetch extracted content when verification is required
  useEffect(() => {
    if (
      run?.docAnalysisStatus === "AWAITING_VERIFICATION" &&
      !extractedContent &&
      !fetchingExtractedContent
    ) {
      setFetchingExtractedContent(true);
      fetchExtractedContent(documentId)
        .then((data) => {
          if (data && data.extracted_content) {
            setExtractedContent(data.extracted_content);
          }
        })
        .catch((err) =>
          console.error(
            "Failed to fetch extracted content on history page:",
            err,
          ),
        )
        .finally(() => setFetchingExtractedContent(false));
    }
  }, [
    run?.docAnalysisStatus,
    extractedContent,
    fetchingExtractedContent,
    documentId,
  ]);

  // FIX: Concurrently track active status before focusing terminal window
  // Keeps historical views stationary on mount while maintaining tracking parameters for active processing tasks
  useEffect(() => {
    if (run?.status === "running" && events.length > 0) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length, run?.status]);

  // Interactive Checklist Action State Management & Debounced Sync
  const handleToggleActionItem = (index) => {
    if (!run || !run.actionItems) return;

    const updatedItems = [...run.actionItems];
    const targetItem = updatedItems[index];

    // Read current values and cleanly invert the completion flag state
    let itemText = "";
    let currentCompletedState = false;

    if (typeof targetItem === "object" && targetItem !== null) {
      itemText = targetItem.text;
      currentCompletedState = !targetItem.completed;
      updatedItems[index] = { ...targetItem, completed: currentCompletedState };
    } else {
      itemText = targetItem;
      currentCompletedState = true;
      updatedItems[index] = {
        text: targetItem,
        completed: currentCompletedState,
        priority: "medium",
        supporting_evidence: "",
      };
    }

    // 1. Optimistic UI update: instantly commit to local state for flawless responsiveness
    setRun((prev) => ({ ...prev, actionItems: updatedItems }));

    // 2. Anti-Spam Buffer System: Clear existing pending synchronization timers for this index
    if (debounceTimersRef.current[index]) {
      clearTimeout(debounceTimersRef.current[index]);
    }

    // 3. Queue network transmission payload after a short cooldown (e.g., 600ms)
    debounceTimersRef.current[index] = setTimeout(async () => {
      try {
        const targetRequestId = run.analysisRequestId || run.id;
        const response = await apiFetch(
          `/analysis/${targetRequestId}/action-items/${index}/toggle`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed: currentCompletedState }),
          },
        );

        if (!response.ok) {
          console.error(
            `Failed synchronization frame check for action item index ${index}`,
          );
        }
      } catch (err) {
        console.error(
          "Failed synchronizing state changes out to repository layer:",
          err,
        );
      } finally {
        delete debounceTimersRef.current[index];
      }
    }, 600); // 600ms user interaction silence delay barrier
  };

  // Confidence Level adapter matching ResultsPanel logic
  const getConfidenceLevel = (score) => {
    if (score >= 0.8) return "high";
    if (score >= 0.5) return "medium";
    return "low";
  };

  const formatConfidence = (aiConfidence) => {
    if (!aiConfidence) return [];
    return Object.entries(aiConfidence)
      .filter(([_, score]) => score > 0)
      .map(([key, score]) => ({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        level: getConfidenceLevel(score),
        note: `${(score * 100).toFixed(0)}% confident`,
      }));
  };

  // Convert schema layout shape to match exact expectations of subcomponent cards
  const getNormalizedResult = () => {
    if (!run) return null;
    return {
      ...run,
      title: run.title || run.fileName || "Document Analysis",
      actions:
        run.actionItems?.map((item) => {
          if (typeof item === "object" && item !== null) {
            return item;
          }
          return {
            text: item,
            completed: false,
            priority: "medium",
            supporting_evidence: "",
          };
        }) || [],
      deadlines: run.keyDeadlines || [],
      questions: run.questionsToAsk || [],
      sources: run.trustedSources || [],
      confidence: formatConfidence(run.aiConfidence),
    };
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* HEADER SKELETON */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/60 pb-5">
          <div className="space-y-2 w-full max-w-md">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-full sm:w-80" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full self-start sm:self-center" />
        </div>

        {/* MESH LAYOUT GRID SKELETON */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-[480px] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto text-center py-16">
        <AlertOctagon size={48} className="mx-auto text-rose-500 mb-4" />
        <h3 className="text-xl font-bold text-slate-200 mb-2">
          Failed to Resolve Run Entry
        </h3>
        <p className="text-slate-500 text-sm mb-6">{error}</p>
        <Link
          href="/history"
          className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-sm text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={16} /> Return to History
        </Link>
      </div>
    );
  }

  const normalizedResult = getNormalizedResult();

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ACTION TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/60 pb-5">
        <div className="min-w-0">
          <Link
            href="/history"
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> BACK TO TIMELINE HISTORY
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 truncate">
            Inspection Matrix:{" "}
            <span className="text-slate-400 font-medium font-mono text-xl">
              {documentId.substring(0, 8)}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              run.status === "completed"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : run.status === "failed"
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
            }`}
          >
            {run.status === "running" && (
              <Loader2 size={12} className="animate-spin" />
            )}
            {run.status?.toUpperCase().replace("_", " ")}
          </span>
        </div>
      </div>

      {/* THREE-COLUMN COMPACT LAYOUT MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT / CENTER: STRUCTURAL ADAPTER OUTPUT */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence mode="wait">
            {run.status === "running" ? (
              run.docAnalysisStatus === "AWAITING_VERIFICATION" ? (
                extractedContent ? (
                  <motion.div
                    key="verification-pane"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ExtractionVerificationPanel
                      documentId={documentId}
                      fileName={run.fileName || "Document"}
                      extractedContent={extractedContent}
                      onConfirm={confirmExtraction}
                      onConfirmed={() => {
                        fetchRunDetail(false);
                      }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="loading-verification-pane"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 text-center"
                  >
                    <Loader2
                      className="animate-spin text-cyan-500 mx-auto mb-3"
                      size={28}
                    />
                    <p className="text-sm text-slate-400">
                      Loading extracted content for review...
                    </p>
                  </motion.div>
                )
              ) : (
                <motion.div
                  key="running-pane"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ ease: "easeIn", duration: 0.3 }}
                  className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 text-center space-y-4"
                >
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto animate-spin">
                    <Loader2 size={24} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-200">
                    Execution Block Interlocked
                  </h3>
                  <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                    The analytical stack is executing processes on this document
                    right now. Content maps will initialize dynamically below.
                  </p>
                </motion.div>
              )
            ) : run.status === "failed" ? (
              <motion.div
                key="failed-pane"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ ease: "easeIn", duration: 0.3 }}
                className="bg-rose-950/10 border border-rose-900/30 p-6 rounded-2xl text-slate-200"
              >
                <div className="flex gap-3 items-start">
                  <AlertOctagon
                    className="text-rose-500 flex-shrink-0 mt-0.5"
                    size={20}
                  />
                  <div>
                    <h4 className="font-bold text-sm text-rose-400">
                      Pipeline Core Exception
                    </h4>
                    <p className="text-xs font-mono mt-2 bg-slate-950/50 p-4 rounded-xl border border-rose-950/40 text-slate-300 max-w-full overflow-x-auto whitespace-pre-wrap">
                      {run.errorMessage ||
                        "Unknown environment context drop out."}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="resolved-content-pane"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ease: "easeInOut", duration: 0.4 }}
                className="space-y-4"
              >
                <SummaryCard result={normalizedResult} />
                {normalizedResult.actions?.length > 0 && (
                  <ChecklistCard
                    result={normalizedResult}
                    onToggleAction={handleToggleActionItem}
                  />
                )}
                {normalizedResult.deadlines?.length > 0 && (
                  <DeadlinesCard result={normalizedResult} />
                )}
                {normalizedResult.questions?.length > 0 && (
                  <QuestionsCard result={normalizedResult} />
                )}
                {normalizedResult.confidence?.length > 0 && (
                  <ConfidenceCard result={normalizedResult} />
                )}
                {normalizedResult.sources?.length > 0 && (
                  <SourcesCard result={normalizedResult} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT SIDEBAR: SPEC DETAILS + TELEMETRY LOGS */}
        <div className="space-y-4">
          {/* TECHNICAL METADATA BLOCK */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold font-display uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Info size={14} /> File Matrix Context
            </h3>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-800/40 pb-2">
                <span className="text-slate-500">FILENAME</span>
                <span
                  className="text-slate-300 font-semibold truncate max-w-[180px]"
                  title={run.fileName}
                >
                  {run.fileName || "N/A"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/40 pb-2">
                <span className="text-slate-500">MIME_TYPE</span>
                <span className="text-slate-300">
                  {run.mimeType || "UNKNOWN"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/40 pb-2">
                <span className="text-slate-500">CAPACITY</span>
                <span className="text-slate-300">
                  {run.fileSizeBytes
                    ? `${(run.fileSizeBytes / 1024).toFixed(1)} KB`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">LANGUAGE</span>
                <span className="text-slate-300 uppercase">
                  {run.language || "EN"}
                </span>
              </div>
            </div>
          </div>

          {/* TELEMETRY ENGINE LOG TERMINAL */}
          <div className="bg-slate-950 border border-slate-900 rounded-2xl overflow-hidden flex flex-col h-[480px] shadow-2xl">
            <div className="bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-950">
              <span className="text-[11px] font-bold tracking-widest text-slate-400 font-mono flex items-center gap-2">
                <Terminal size={14} className="text-blue-500" />{" "}
                ENGINE_PIPELINE_OUT
              </span>
              {run.status === "running" && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </div>

            <div className="p-4 overflow-y-auto flex-1 font-mono text-[10px] space-y-2.5 text-slate-400 scrollbar-thin select-text">
              {events.length === 0 ? (
                <p className="text-slate-600 italic text-center pt-8">
                  No operational telemetry records buffered.
                </p>
              ) : (
                events.map((e, idx) => (
                  <div
                    key={e.id || idx}
                    className="border-b border-slate-900/60 pb-2 last:border-0 leading-normal flex items-start gap-2"
                  >
                    <span className="text-slate-600 flex-shrink-0">
                      [
                      {e.createdAt
                        ? new Date(e.createdAt).toLocaleTimeString()
                        : "LOG"}
                      ]
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-blue-400 font-semibold mr-1">
                        [{e.stage?.toUpperCase() || "CORE"}]
                      </span>
                      <span className="text-slate-300">{e.message}</span>
                    </div>
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
