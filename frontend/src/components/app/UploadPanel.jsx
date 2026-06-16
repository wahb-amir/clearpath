"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  Upload,
  Type,
  Sparkles,
  RefreshCw,
  FileStack,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  Loader2,
  FileText,
} from "lucide-react";

import { sampleDocuments } from "@/lib/mockData";
import { useIsMobile } from "@/lib/useIsMobile";
import {
  openAnalysisStream,
  startAnalysisRequest,
} from "@/lib/api/documentAnalysis";

import {
  EVENT_LABELS,
  MAX_UPLOAD_BYTES,
  stageToProgress,
  isAcceptedDocumentFile,
} from "../document-intelligence/constants";
import FileUploadDropzone from "../document-intelligence/FileUploadDropzone";
import SampleSelector from "../document-intelligence/SampleSelector";
import PanelActions from "../document-intelligence/PanelActions";
import ExecutionStatusCard from "../document-intelligence/ExecutionStatusCard";

const ScanAnimation = dynamic(() => import("@/components/3d/ScanAnimation"), {
  ssr: false,
});

async function uploadDocumentFile(file) {
  const baseUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";

  // 1) Ask backend to create DB row + signed upload URL
  const signResponse = await fetch(`${baseUrl}/uploads/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }),
    credentials: "include", 
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


  const { error: uploadError } = await supabase.storage
    .from("documents")
    .uploadToSignedUrl(path, uploadToken, file, {
      contentType: file.type,
    });

  if (uploadError) {
    // Tell backend this upload attempt failed
    await fetch(`${baseUrl}/uploads/fail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        documentId,
        uploadSessionId,
        reason: uploadError.message,
      }),
      credentials: "include",
    });

    throw uploadError;
  }

   const { supabaseBrowser:supabase } = await import("@/lib/supabase/browser-client");


  // 3) Tell backend to verify and mark uploaded
  const completeResponse = await fetch(`${baseUrl}/uploads/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      documentId,
      uploadSessionId,
    }),
    credentials: "include",
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

export default function DocumentIntelligencePanel({ onAnalyze, analyzing = false }) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedSample, setSelectedSample] = useState(sampleDocuments[0]?.id);
  const [pasteText, setPasteText] = useState("");
  const [activeTab, setActiveTab] = useState("upload");

  const [selectedFile, setSelectedFile] = useState(null);

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

  const abortRef = useRef(null);
  const seenEventIdsRef = useRef(new Set());
  const lastEventIdRef = useRef(null);
  const timelineEndRef = useRef(null);

  const isMobile = useIsMobile();
  const busy = analyzing || isAnalyzing;

  const selectedDoc = useMemo(
    () => sampleDocuments.find((d) => d.id === selectedSample),
    [selectedSample]
  );

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
      typeof data.progress === "number"
        ? data.progress
        : stageToProgress(data.stage)
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
        typeof data.payload?.error === "string"
          ? data.payload.error
          : "Analysis failed"
      );
    }

    pushTimeline({
      eventId,
      name: eventName,
      label: EVENT_LABELS[eventName] ?? eventName,
      stage: data.stage,
      message: data.message,
      progress:
        typeof data.progress === "number"
          ? data.progress
          : stageToProgress(data.stage),
      payload: data.payload,
      createdAt: data.createdAt || new Date().toISOString(),
    });
  };

  const handleFileSelect = (file) => {
    if (!file) return;

    if (!isAcceptedDocumentFile(file)) {
      setError("Unsupported file type. Use PDF, DOC, DOCX, or TXT.");
      setFailed(true);
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError("File too large. Maximum size is 50MB.");
      setFailed(true);
      setSelectedFile(null);
      return;
    }

    setError(null);
    setFailed(false);
    setCompleted(false);
    setSelectedFile(file);
    setActiveTab("upload");
    setMessage("File ready to upload");
  };

  const handleClearFile = () => {
    if (busy) return;
    setSelectedFile(null);
  };

  const handleAnalyze = async () => {
    const doc = selectedDoc || sampleDocuments[0];

    setError(null);
    setFailed(false);
    setCompleted(false);
    setTimeline([]);
    setMessage(selectedFile ? "Uploading document…" : "Initializing analysis…");
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
      let documentId = doc?.id;

      if (activeTab === "upload") {
        if (!selectedFile) {
          throw new Error("Choose a document first.");
        }

        const uploadResult = await uploadDocumentFile(selectedFile);
        documentId =
          uploadResult?.documentId ||
          uploadResult?.id ||
          uploadResult?.document?.id;

        if (!documentId) {
          throw new Error("Upload succeeded, but no documentId was returned.");
        }
      }

      const response = await startAnalysisRequest({
        documentId,
        purpose: "full_analysis",
        analysisVersion: "v1",
      });

      setAnalysisRequestId(response.analysisRequestId);
      setWorkerId(response.workerId);
      setStage(response.currentStatus);
      setMessage(
        response.deduplication?.isNewRequest
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
    setPasteText(doc?.preview || "");
    setActiveTab("paste");
  };

  const statusMeta = completed
    ? { text: "Completed", tone: "success" }
    : failed
    ? { text: "Failed", tone: "danger" }
    : reconnecting
    ? { text: "Reconnecting", tone: "warning" }
    : isConnected
    ? { text: "Live", tone: "live" }
    : { text: "Idle", tone: "neutral" };

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

        <AnimatePresence mode="wait">
          {activeTab === "upload" ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              <FileUploadDropzone
                busy={busy}
                isMobile={isMobile}
                selectedFile={selectedFile}
                onSelectFile={handleFileSelect}
                onClearFile={handleClearFile}
                ScanAnimation={ScanAnimation}
              />
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

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <SampleSelector
            sampleDocuments={sampleDocuments}
            selectedSample={selectedSample}
            onSelectSample={setSelectedSample}
          />

          <PanelActions
            busy={busy}
            activeTab={activeTab}
            selectedFile={selectedFile}
            onLoadSample={handleLoadSample}
            onAnalyze={handleAnalyze}
            onClearFile={handleClearFile}
          />
        </div>

        <ExecutionStatusCard
          message={message}
          badgeColors={badgeColors}
          statusMeta={statusMeta}
          progress={progress}
          progressFillClass={progressFillClass}
          stage={stage}
          completed={completed}
          failed={failed}
          timeline={timeline}
          latestEventId={latestEventId}
          timelineEndRef={timelineEndRef}
          analysisRequestId={analysisRequestId}
          workerId={workerId}
          error={error}
        />
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