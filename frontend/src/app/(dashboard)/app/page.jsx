"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import UploadPanel from "@/components/app/UploadPanel";
import ResultsPanel from "@/components/app/ResultsPanel";
import { Zap } from "lucide-react";

export default function AppPage() {
  const [currentDoc, setCurrentDoc] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = (doc) => {
    setAnalyzing(true);
    setCurrentDoc(null);

    setTimeout(() => {
      setAnalyzing(false);
      setCurrentDoc(doc);
    }, 2800);
  };

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          background: "hsl(222, 47%, 5%)",
          paddingTop: "72px",
        }}
      >
        {/* Page header */}
        <div
          style={{
            borderBottom: "1px solid hsla(222, 25%, 14%, 0.8)",
            padding: "1.5rem",
            background: "hsla(222, 40%, 7%, 0.6)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  <Zap size={18} color="hsl(191, 100%, 50%)" />
                  <h1
                    style={{
                      fontFamily: "Outfit, sans-serif",
                      fontWeight: 800,
                      fontSize: "1.375rem",
                      letterSpacing: "-0.02em",
                      color: "hsl(220, 20%, 93%)",
                    }}
                  >
                    ClearPath Dashboard
                  </h1>
                </div>

                <p style={{ color: "hsl(220, 8%, 50%)", fontSize: "0.82rem" }}>
                  Upload or paste a document to get instant AI-powered clarity.
                </p>
              </div>

              {currentDoc && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "10px",
                    background: "hsla(142, 71%, 45%, 0.08)",
                    border: "1px solid hsla(142, 71%, 45%, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "hsl(142, 71%, 50%)",
                    }}
                  />
                  <span
                    style={{
                      color: "hsl(142, 71%, 60%)",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                    }}
                  >
                    Analysis complete · {currentDoc.label}
                  </span>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Main dashboard grid */}
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
          {/* Left: Input */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <UploadPanel
              onAnalyze={handleAnalyze}
              analyzing={analyzing}
              currentDoc={currentDoc}
            />
          </motion.div>

          {/* Right: Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <ResultsPanel currentDoc={currentDoc} analyzing={analyzing} />
          </motion.div>
        </div>

        <style jsx>{`
          @media (max-width: 768px) {
            .app-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </>
  );
}