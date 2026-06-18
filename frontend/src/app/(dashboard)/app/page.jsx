"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import UploadPanel from "@/components/app/UploadPanel";
import ResultsPanel from "@/components/app/ResultsPanel";
import { Zap } from "lucide-react";

export default function AppPage() {
  const [currentDoc, setCurrentDoc] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const handleAnalyze = (doc) => {
    setAnalyzing(true);
    setCurrentDoc(doc);
  };

  return (
    <div style={{ minHeight: "100vh", background: "hsl(222, 47%, 5%)", paddingTop: "72px" }}>
      {/* header stays the same */}

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
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <UploadPanel
            onAnalyze={handleAnalyze}
            onAiResult={setAiResult}
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