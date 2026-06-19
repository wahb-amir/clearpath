"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft, Terminal, FileCheck, Info, AlertOctagon } from "lucide-react";
import { apiFetch } from "@/lib/auth/apiFetch";

// Direct imports of modular layout cards for pixel-perfect ResultsPanel parity
import SummaryCard from "@/components/results/SummaryCard";
import ChecklistCard from "@/components/results/ChecklistCard";
import DeadlinesCard from "@/components/results/DeadlinesCard";
import QuestionsCard from "@/components/results/QuestionsCard";
import ConfidenceCard from "@/components/results/ConfidenceCard";
import SourcesCard from "@/components/results/SourcesCard";

export default function RunDetailPage() {
  const { documentId } = useParams();
  const router = useRouter();

  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const eventSourceRef = useRef(null);
  const terminalEndRef = useRef(null);

  // Modular execution query fetcher
  const fetchRunDetail = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await apiFetch(`/analysis/runs/${documentId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error("Analysis run details could not be found.");
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
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [documentId]);

  // Live SSE listener strategy for handling active processes
  useEffect(() => {
    if (!run || run.status !== "running") {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Connect to your streaming update architecture
    const sseUrl = `/api/documents/${documentId}/events`;
    eventSourceRef.current = new EventSource(sseUrl);

    eventSourceRef.current.onmessage = (event) => {
      try {
        const rawPayload = JSON.parse(event.data);
        
        const newEvent = {
          id: rawPayload.id || Date.now(),
          stage: rawPayload.stage || run.currentStage || "PROCESSING",
          message: rawPayload.message || rawPayload.text || "Step complete.",
          createdAt: new Date().toISOString()
        };

        setEvents((prev) => [...prev, newEvent]);

        // Automatically scroll terminal to the latest event trace
        terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });

        // Trigger database re-fetch and close channel upon hitting terminal phase flags
        if (rawPayload.status && rawPayload.status !== "running") {
          eventSourceRef.current?.close();
          eventSourceRef.current = null;
          fetchRunDetail(false);
        }
      } catch (err) {
        console.error("Failed parsing inbound stream payload frame:", err);
      }
    };

    eventSourceRef.current.onerror = () => {
      console.warn("SSE connection dropped frame stream channel. Auto-retry pending.");
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [run?.status, documentId]);

  // Scroll terminal logs on loading historical lists
  useEffect(() => {
    if (events.length > 0) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length]);

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
        note: `Scored ${(score * 100).toFixed(0)}% based on mathematical density arrays.`
      }));
  };

  // Convert schema layout shape to match exact expectations of subcomponent cards
  const getNormalizedResult = () => {
    if (!run) return null;
    return {
      ...run,
      title: run.title || run.fileName || "Document Analysis",
      actions: run.actionItems?.map(item => typeof item === 'object' ? item.text : item) || [],
      deadlines: run.keyDeadlines || [],
      questions: run.questionsToAsk || [],
      sources: run.trustedSources || [],
      confidence: formatConfidence(run.aiConfidence)
    };
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="text-blue-500 animate-spin" size={32} />
        <p className="text-slate-400 text-sm font-mono">Hydrating analytical timeline arrays...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto text-center py-16">
        <AlertOctagon size={48} className="mx-auto text-rose-500 mb-4" />
        <h3 className="text-xl font-bold text-slate-200 mb-2">Failed to Resolve Run Entry</h3>
        <p className="text-slate-500 text-sm mb-6">{error}</p>
        <Link href="/history" className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-sm text-slate-300 hover:bg-slate-800">
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
          <Link href="/history" className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 mb-2 transition-colors">
            <ArrowLeft size={14} /> BACK TO TIMELINE HISTORY
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 truncate">
            Inspection Matrix: <span className="text-slate-400 font-medium font-mono text-xl">{documentId.substring(0, 8)}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            run.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            run.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
            'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
          }`}>
            {run.status === 'running' && <Loader2 size={12} className="animate-spin" />}
            {run.status?.toUpperCase().replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* THREE-COLUMN COMPACT LAYOUT MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT / CENTER: STRUCTURAL ADAPTER OUTPUT */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence mode="wait">
            {run.status === "running" ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 text-center space-y-4"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto animate-spin">
                  <Loader2 size={24} />
                </div>
                <h3 className="text-lg font-semibold text-slate-200">Execution Block Interlocked</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                  The analytical stack is executing processes on this document right now. Content maps will initialize dynamically below.
                </p>
              </motion.div>
            ) : run.status === "failed" ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-rose-950/10 border border-rose-900/30 p-6 rounded-2xl text-slate-200"
              >
                <div className="flex gap-3 items-start">
                  <AlertOctagon className="text-rose-500 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-bold text-sm text-rose-400">Pipeline Core Exception</h4>
                    <p className="text-xs font-mono mt-2 bg-slate-950/50 p-4 rounded-xl border border-rose-950/40 text-slate-300 max-w-full overflow-x-auto whitespace-pre-wrap">
                      {run.errorMessage || "Unknown environment context drop out."}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Unified injection matching identical ResultsPanel bindings */}
                <SummaryCard result={normalizedResult} />
                {normalizedResult.actions?.length > 0 && <ChecklistCard result={normalizedResult} />}
                {normalizedResult.deadlines?.length > 0 && <DeadlinesCard result={normalizedResult} />}
                {normalizedResult.questions?.length > 0 && <QuestionsCard result={normalizedResult} />}
                {normalizedResult.confidence?.length > 0 && <ConfidenceCard result={normalizedResult} />}
                {normalizedResult.sources?.length > 0 && <SourcesCard result={normalizedResult} />}
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
                <span className="text-slate-300 font-semibold truncate max-w-[180px]" title={run.fileName}>{run.fileName || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/40 pb-2">
                <span className="text-slate-500">MIME_TYPE</span> 
                <span className="text-slate-300">{run.mimeType || 'UNKNOWN'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/40 pb-2">
                <span className="text-slate-500">CAPACITY</span> 
                <span className="text-slate-300">{run.fileSizeBytes ? `${(run.fileSizeBytes / 1024).toFixed(1)} KB` : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">LANGUAGE</span> 
                <span className="text-slate-300 uppercase">{run.language || 'EN'}</span>
              </div>
            </div>
          </div>

          {/* TELEMETRY ENGINE LOG TERMINAL */}
          <div className="bg-slate-950 border border-slate-900 rounded-2xl overflow-hidden flex flex-col h-[480px] shadow-2xl">
            <div className="bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-950">
              <span className="text-[11px] font-bold tracking-widest text-slate-400 font-mono flex items-center gap-2">
                <Terminal size={14} className="text-blue-500" /> ENGINE_PIPELINE_OUT
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
                <p className="text-slate-600 italic text-center pt-8">No operational telemetry records buffered.</p>
              ) : (
                events.map((e, idx) => (
                  <div key={e.id || idx} className="border-b border-slate-900/60 pb-2 last:border-0 leading-normal flex items-start gap-2">
                    <span className="text-slate-600 flex-shrink-0">
                      [{e.createdAt ? new Date(e.createdAt).toLocaleTimeString() : "LOG"}]
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-blue-400 font-semibold mr-1">[{e.stage?.toUpperCase() || "CORE"}]</span>
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