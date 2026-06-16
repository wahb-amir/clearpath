"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Upload,
  FileText,
  Type,
  ChevronDown,
  Sparkles,
  RefreshCw,
  FileStack,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  Activity,
} from "lucide-react";
import dynamic from "next/dynamic";
import { sampleDocuments } from "@/lib/mockData";
import { useIsMobile } from "@/lib/useIsMobile";
import {
  openAnalysisStream,
  startAnalysisRequest,
} from "@/lib/api/documentAnalysis";

const ScanAnimation = dynamic(() => import("@/components/3d/ScanAnimation"), {
  ssr: false,
});

const EVENT_LABELS = {
  snapshot: "Snapshot",
  queued: "Queued",
  worker_assigned: "Worker assigned",
  extraction_started: "Extraction started",
  extraction_progress: "Extraction progress",
  text_cleaned: "Text cleaned",
  language_detected: "Language detected",
  structure_preserved: "Structure preserved",
  chunking_completed: "Chunking completed",
  embedding_completed: "Embedding completed",
  summary_created: "Summary created",
  analysis_completed: "Analysis completed",
  failed: "Failed",
  heartbeat: "Heartbeat",
};

function stageToProgress(stage) {
  switch (stage) {
    case "QUEUED":
      return 0;
    case "PROCESSING":
      return 5;
    case "EXTRACTING":
      return 15;
    case "CLEANING":
      return 35;
    case "STRUCTURING":
      return 45;
    case "CHUNKING":
      return 60;
    case "EMBEDDING":
      return 80;
    case "SUMMARIZING":
      return 90;
    case "COMPLETED":
      return 100;
    case "FAILED":
      return 100;
    default:
      return 0;
  }
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Math.max(0, Date.now() - new Date(ts).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 1) return "now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

export default function UploadPanel({ onAnalyze, analyzing = false }) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedSample, setSelectedSample] = useState(sampleDocuments[0].id);
  const [pasteText, setPasteText] = useState("");
  const [showSampleDropdown, setShowSampleDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");
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
  const [error, setError] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [latestEventId, setLatestEventId] = useState(null);
  const isMobile = useIsMobile();

  const abortRef = useRef(null);
  const seenEventIdsRef = useRef(new Set());
  const lastEventIdRef = useRef(null);
  const timelineEndRef = useRef(null);
  const dropdownRef = useRef(null);

  const busy = analyzing || isAnalyzing;

  const selectedDoc = useMemo(
    () => sampleDocuments.find((d) => d.id === selectedSample),
    [selectedSample]
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSampleDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (timelineEndRef.current) {
      timelineEndRef.current.scrollTop = timelineEndRef.current.scrollHeight;
    }
  }, [timeline.length]);

  const pushTimeline = (item) => {
    setTimeline((prev) => {
      if (prev.some((x) => x.eventId === item.eventId)) return prev;
      return [...prev, item];
    });
  };

  const applyEvent = (eventName, eventId, data) => {
    if (seenEventIdsRef.current.has(eventId)) return;
    seenEventIdsRef.current.add(eventId);
    lastEventIdRef.current = eventId;

    setStage(data.stage);
    setMessage(data.message || "Updated");
    setProgress(
      typeof data.progress === "number" ? data.progress : stageToProgress(data.stage)
    );
    setIsConnected(true);
    setReconnecting(false);
    setLatestEventId(eventId);

    if (data.payload && typeof data.payload.workerId === "string") {
      setWorkerId(data.payload.workerId);
    }

    if (data.stage === "COMPLETED") {
      setCompleted(true);
      setIsAnalyzing(false);
      setIsConnected(false);
    }

    if (data.stage === "FAILED") {
      setFailed(true);
      setIsAnalyzing(false);
      setIsConnected(false);
      setError(
        typeof data.payload?.error === "string" ? data.payload.error : "Analysis failed"
      );
    }

    pushTimeline({
      eventId,
      name: eventName,
      label: EVENT_LABELS[eventName] ?? eventName,
      stage: data.stage,
      message: data.message,
      progress:
        typeof data.progress === "number" ? data.progress : stageToProgress(data.stage),
      payload: data.payload,
      createdAt: data.createdAt || new Date().toISOString(),
    });
  };

  const handleAnalyze = async () => {
    const doc = selectedDoc || sampleDocuments[0];

    setError(null);
    setFailed(false);
    setCompleted(false);
    setTimeline([]);
    setMessage("Initializing analysis…");
    setProgress(0);
    setStage("QUEUED");
    setIsAnalyzing(true);
    setIsConnected(false);
    setReconnecting(false);
    setLatestEventId(null);
    seenEventIdsRef.current = new Set();
    lastEventIdRef.current = null;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await startAnalysisRequest({
        documentId: doc.id,
        purpose: "full_analysis",
        analysisVersion: "v1",
      });

      setAnalysisRequestId(response.analysisRequestId);
      setWorkerId(response.workerId);
      setStage(response.currentStatus);
      setMessage(
        response.deduplication.isNewRequest
          ? "Analysis request created"
          : "Existing analysis request resumed"
      );
      setProgress(stageToProgress(response.currentStatus));

      onAnalyze?.(response);

      void openAnalysisStream({
        sseUrl: response.sseUrl,
        signal: controller.signal,
        lastEventId: lastEventIdRef.current,
        onMessage: (eventName, data, eventId) => {
          applyEvent(eventName, eventId, data);
        },
        onError: (err) => {
          if (controller.signal.aborted) return;
          setIsConnected(false);
          setReconnecting(true);
          setError(err instanceof Error ? err.message : "Connection interrupted");
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
  };

  const handleLoadSample = () => {
    const doc = selectedDoc || sampleDocuments[0];
    setPasteText(doc.preview);
    setActiveTab("paste");
  };

  const statusMeta = completed
    ? { text: "Completed", tone: "success", Icon: CheckCircle2 }
    : failed
    ? { text: "Failed", tone: "danger", Icon: AlertCircle }
    : reconnecting
    ? { text: "Reconnecting", tone: "warning", Icon: Loader2 }
    : isConnected
    ? { text: "Live", tone: "live", Icon: Wifi }
    : { text: "Idle", tone: "neutral", Icon: WifiOff };

  const badgeColors = {
    live: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    danger: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    neutral: "bg-white/5 text-gray-400 border border-white/10",
  };

  const progressFillClass = failed
    ? "bg-gradient-to-r from-rose-500 to-rose-400"
    : completed
    ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
    : "bg-gradient-to-r from-blue-600 to-blue-400";

  return (
    <div
      className="w-full max-w-4xl mx-auto font-sans text-gray-100"
      style={{ position: "sticky", top: "80px" }}
    >
      <div className="bg-[#13151A] border border-[#2B303B] rounded-[24px] p-5 sm:p-7 shadow-2xl shadow-black/40">
        {/* Header Section */}
        <div className="flex items-center gap-3 mb-6">
          <div className="grid place-items-center w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner shadow-blue-500/10">
            <FileStack size={20} />
          </div>
          <div>
            <h2 className="m-0 text-base sm:text-lg font-semibold tracking-tight text-white">
              Document Intelligence
            </h2>
            <p className="m-0 text-xs sm:text-sm text-gray-400 mt-0.5">
              Securely analyze and extract insights from your data
            </p>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="grid grid-cols-2 gap-1.5 bg-[#0B0D10] rounded-xl p-1.5 border border-[#2B303B]">
          {[
            { id: "upload", label: "Upload file", icon: Upload },
            { id: "paste", label: "Paste text", icon: Type },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`w-full min-w-0 inline-flex items-center justify-center gap-2 py-2 px-2 sm:px-3 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 ${
                  active
                    ? "bg-[#252A34] text-white shadow-sm border border-[#3A4150]"
                    : "bg-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Input Area */}
        <AnimatePresence mode="wait">
          {activeTab === "upload" ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                }}
                className={`mt-5 min-h-[180px] rounded-[18px] border-2 border-dashed flex items-center justify-center p-6 transition-all duration-200 ${
                  dragOver
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-[#2B303B] bg-[#0B0D10] hover:border-[#3A4150]"
                }`}
              >
                {busy && !isMobile ? (
                  <ScanAnimation scanning={busy} />
                ) : (
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-[#1A1D24] border border-[#2B303B] flex items-center justify-center mx-auto mb-3">
                      <Upload size={20} className="text-blue-400" />
                    </div>
                    <p className="m-0 text-sm font-medium text-gray-200">
                      Drag & drop to upload
                    </p>
                    <p className="m-0 text-xs text-gray-500 mt-1">
                      PDF, DOCX, TXT up to 50MB
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="paste"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              <textarea
                className="w-full min-h-[180px] mt-5 py-3.5 px-4 rounded-[18px] border border-[#2B303B] text-sm resize-y text-gray-200 bg-[#0B0D10] focus:outline-none focus:border-blue-500 focus:bg-[#13151A] transition-colors placeholder:text-gray-600"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste raw document text or JSON here..."
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dropdown & Actions container */}
        <div
          className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]"
          ref={dropdownRef}
        >
          {/* Sample Dropdown */}
          <div className="relative min-w-0">
            <button
              type="button"
              className="w-full min-w-0 flex items-center justify-between gap-2 py-2.5 px-3.5 rounded-xl border border-[#2B303B] bg-[#1A1D24] text-sm text-gray-200 hover:bg-[#252A34] transition-colors"
              onClick={() => setShowSampleDropdown((v) => !v)}
            >
              <span className="truncate min-w-0 text-left pr-2">
                {selectedDoc?.label || "Select Sample"}
              </span>
              <ChevronDown
                size={16}
                className={`text-gray-400 shrink-0 transition-transform duration-200 ${
                  showSampleDropdown ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {showSampleDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 z-20 mt-2 border border-[#2B303B] rounded-xl bg-[#1A1D24] shadow-xl shadow-black/50 overflow-hidden backdrop-blur-xl"
                >
                  <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                    {sampleDocuments.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        className="w-full text-left py-2.5 px-3.5 border-b border-[#2B303B] last:border-b-0 hover:bg-[#252A34] transition-colors"
                        onClick={() => {
                          setSelectedSample(doc.id);
                          setShowSampleDropdown(false);
                        }}
                      >
                        <div className="font-medium text-sm text-gray-200">
                          {doc.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                          {doc.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <button
              type="button"
              className="w-full min-w-0 py-2.5 px-4 rounded-xl border border-[#2B303B] bg-[#1A1D24] text-gray-200 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[#252A34] transition-colors"
              onClick={handleLoadSample}
            >
              <FileText size={16} className="text-gray-400 shrink-0" />
              <span className="truncate">Load sample</span>
            </button>

            <button
              type="button"
              className="w-full min-w-0 py-2.5 px-4 rounded-xl border-none bg-blue-600 text-white text-sm font-semibold inline-flex justify-center items-center gap-2 hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 disabled:bg-[#2B303B] disabled:text-gray-500 disabled:shadow-none"
              onClick={handleAnalyze}
              disabled={busy}
            >
              {busy ? (
                <>
                  <RefreshCw size={16} className="animate-spin shrink-0" />
                  <span className="truncate">Processing</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} className="shrink-0" />
                  <span className="truncate">Run Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Status & Live Feed Card */}
        <div className="mt-6 p-5 sm:p-6 rounded-[20px] border border-[#2B303B] bg-[#0B0D10]">
          {/* Top Status Header */}
          <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center mb-4">
            <div>
              <div className="font-semibold text-sm text-white">
                Execution Status
              </div>
              <div className="text-xs sm:text-sm text-gray-400 mt-1">
                {message}
              </div>
            </div>

            <span
              className={`py-1.5 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm ${
                badgeColors[statusMeta.tone]
              }`}
            >
              {statusMeta.tone === "warning" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
              )}
              {statusMeta.text}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 bg-[#1A1D24] rounded-full overflow-hidden mb-2">
            <motion.div
              className={`h-full rounded-full ${progressFillClass}`}
              initial={false}
              animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            />
          </div>

          <div className="text-xs font-medium text-gray-500 flex justify-between tracking-wide uppercase">
            <span>{stage !== "IDLE" ? stage.replace(/_/g, " ") : "WAITING"}</span>
            <span
              className={
                completed
                  ? "text-emerald-400"
                  : failed
                  ? "text-rose-400"
                  : "text-blue-400"
              }
            >
              {progress}%
            </span>
          </div>

          {/* Dynamic Live Events Feed */}
          <div className="mt-8 border-t border-[#2B303B] pt-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-sm text-gray-200 flex items-center gap-2">
                <Activity size={16} className="text-blue-400" /> Server Logs
              </span>
              <span className="text-xs font-medium text-gray-500 bg-[#1A1D24] py-1 px-2.5 rounded-full border border-[#2B303B]">
                {timeline.length} Event{timeline.length !== 1 && "s"}
              </span>
            </div>

            <div
              className="relative flex flex-col gap-0 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar"
              ref={timelineEndRef}
            >
              {timeline.length === 0 ? (
                <div className="py-8 px-4 text-center text-sm text-gray-500 border border-dashed border-[#2B303B] rounded-xl bg-[#13151A]">
                  Awaiting execution triggers. Logs will appear dynamically.
                </div>
              ) : (
                <LayoutGroup>
                  <AnimatePresence initial={false}>
                    {timeline.map((item, idx) => {
                      const isLast = idx === timeline.length - 1;
                      const isLatest = item.eventId === latestEventId;

                      const dotToneClass =
                        item.stage === "FAILED"
                          ? "bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.15)]"
                          : item.stage === "COMPLETED"
                          ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
                          : "bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.15)]";

                      return (
                        <motion.div
                          key={item.eventId}
                          layout
                          initial={{ opacity: 0, x: -10, filter: "blur(4px)" }}
                          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                          className="relative flex gap-3.5 py-2.5 group"
                        >
                          {/* Rail & Dot */}
                          <div className="flex flex-col items-center w-5 shrink-0">
                            <motion.span
                              className={`w-2 h-2 rounded-full mt-1.5 shrink-0 z-10 ${dotToneClass}`}
                              animate={isLatest ? { scale: [1, 1.5, 1] } : { scale: 1 }}
                              transition={{ duration: 0.6, ease: "easeInOut" }}
                            />
                            {!isLast && (
                              <span className="w-px flex-1 bg-[#2B303B] mt-1.5 group-hover:bg-[#3A4150] transition-colors" />
                            )}
                          </div>

                          {/* Event Body */}
                          <div className="flex-1 pb-1">
                            <div className="flex justify-between gap-3 items-baseline">
                              <span
                                className={`text-[13px] font-medium ${
                                  isLatest ? "text-white" : "text-gray-300"
                                }`}
                              >
                                {item.label}
                              </span>
                              <span className="text-[11px] text-gray-500 whitespace-nowrap shrink-0 font-mono tracking-tight">
                                {timeAgo(item.createdAt)}
                              </span>
                            </div>
                            {item.message && (
                              <div className="text-xs text-gray-400 mt-1 leading-relaxed">
                                {item.message}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </LayoutGroup>
              )}
            </div>
          </div>

          {/* Meta Info / Debug IDs */}
          {(analysisRequestId || workerId) && (
            <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-[#1A1D24] text-[11px] text-gray-500">
              {analysisRequestId && (
                <span className="flex items-center gap-1.5">
                  REQ{" "}
                  <code className="text-[10.5px] bg-[#1A1D24] text-gray-300 py-0.5 px-1.5 rounded border border-[#2B303B] font-mono">
                    {analysisRequestId}
                  </code>
                </span>
              )}
              {workerId && (
                <span className="flex items-center gap-1.5">
                  NODE{" "}
                  <code className="text-[10.5px] bg-[#1A1D24] text-gray-300 py-0.5 px-1.5 rounded border border-[#2B303B] font-mono">
                    {workerId}
                  </code>
                </span>
              )}
            </div>
          )}

          {/* Error State */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-3 items-start shadow-inner shadow-rose-500/5"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Global styles for custom scrollbar within this component scope */}
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
