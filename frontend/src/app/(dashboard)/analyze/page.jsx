"use client";

import { motion } from "framer-motion";
import useSWR from "swr";
import UploadPanel from "@/components/app/UploadPanel";
import ResultsPanel from "@/components/app/ResultsPanel";
import { apiFetch } from "@/lib/auth/apiFetch";

export default function AppPage() {
  // 1. Fetch exactly ONCE on load, and ONCE when the user focuses the tab.
  // NO refreshInterval. We don't spam the server.
  const { data: statusData, mutate } = useSWR(
    "/analysis/running-check",
    async (url) => {
      const res = await apiFetch(url);
      if (!res.ok) return { running: false, document: null };
      return res.json();
    },
    {
      revalidateOnFocus: true, // Syncs state if they opened a run on their phone/another tab
      revalidateOnMount: true,
    },
  );

  const analyzing = !!statusData?.running;

  const currentDoc = statusData?.document
    ? { id: statusData.document.id, name: statusData.document.fileName }
    : null;

  // 2. When a user uploads a file, instantly force SWR into the "running" state locally.
  const handleAnalyze = async (doc) => {
    mutate(
      {
        running: true,
        document: { id: doc.id, fileName: doc.name, analysisStatus: "running" },
      },
      { revalidate: false }, // false = don't immediately re-fetch from the server, trust our local state
    );
  };

  // 3. This will be triggered by ResultsPanel when the SSE stream officially finishes.
  const handleAnalysisComplete = () => {
    // Clear out active tracking blocks, resetting the UI
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
          <UploadPanel onAnalyze={handleAnalyze} analyzing={analyzing} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <ResultsPanel
            currentDoc={currentDoc}
            analyzing={analyzing}
            aiResult={statusData?.document}
            onComplete={handleAnalysisComplete} // ◄ Pass completion callback down to the panel
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
