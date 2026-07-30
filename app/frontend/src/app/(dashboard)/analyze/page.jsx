"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import useSWR from "swr";
import UploadPanel from "@/components/app/UploadPanel";
import ResultsPanel from "@/components/app/ResultsPanel";
import { apiFetch } from "@/lib/auth/apiFetch";

export default function AppPage() {
  // aiResult is populated by the SSE onAiResult callback when
  // analysis_completed / ai_completed fires with the full payload.
  const [aiResult, setAiResult] = useState(null);

  // Track local analyzing state so the panel goes to skeleton immediately
  // when the user clicks Analyze, before the first SSE event arrives.
  const [localAnalyzing, setLocalAnalyzing] = useState(false);
  const [localDoc, setLocalDoc] = useState(null);

  // Also keep the server-side running-check for page refresh / tab sync.
  const { data: statusData, mutate } = useSWR(
    "/analysis/running-check",
    async (url) => {
      const res = await apiFetch(url);
      if (!res.ok) return { running: false, document: null };
      return res.json();
    },
    {
      revalidateOnFocus: true,
      revalidateOnMount: true,
    },
  );

  const analyzing = localAnalyzing || !!statusData?.running;

  const currentDoc =
    localDoc ??
    (statusData?.document
      ? { id: statusData.document.id, name: statusData.document.fileName }
      : null);

  // Called by UploadPanel when the user triggers a new analysis.
  const handleAnalyze = async (doc) => {
    setAiResult(null);
    setLocalAnalyzing(true);
    setLocalDoc({ id: doc.id, name: doc.name });
    // Optimistically update the SWR cache so the running-check reflects state
    mutate(
      {
        running: true,
        document: { id: doc.id, fileName: doc.name, analysisStatus: "running" },
      },
      { revalidate: false },
    );
  };

  // Called by UploadPanel whenever the SSE emits ai_completed or analysis_completed.
  // This is where the full result payload arrives — wire it straight to ResultsPanel.
  const handleAiResult = (result) => {
    if (result) setAiResult(result);
  };

  // Called by UploadPanel when stage reaches COMPLETED or FAILED.
  const handleAnalysisComplete = () => {
    setLocalAnalyzing(false);
    setLocalDoc(null);
    mutate({ running: false, document: null }, { revalidate: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "hsl(222, 47%, 5%)",
        paddingTop: "72px",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "1.5rem",
          display: "grid",
          gridTemplateColumns: "clamp(300px, 35%, 420px) 1fr",
          gap: "1.5rem",
          alignItems: "start",
        }}
        className="app-grid"
      >
        <div
          id="verification-panel-portal"
          style={{ gridColumn: "1 / -1" }}
          className="empty:hidden"
        ></div>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <UploadPanel
            onAnalyze={handleAnalyze}
            onAiResult={handleAiResult}
            onComplete={handleAnalysisComplete}
            analyzing={analyzing}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <ResultsPanel
            currentDoc={currentDoc}
            analyzing={analyzing}
            aiResult={aiResult}
          />
        </motion.div>
      </div>
      <style jsx>{`
        @media (max-width: 1024px) {
          .app-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
