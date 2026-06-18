"use client";

import { motion, AnimatePresence } from "framer-motion";
import SummaryCard from "@/components/results/SummaryCard";
import ChecklistCard from "@/components/results/ChecklistCard";
import DeadlinesCard from "@/components/results/DeadlinesCard";
import QuestionsCard from "@/components/results/QuestionsCard";
import ConfidenceCard from "@/components/results/ConfidenceCard";
import SourcesCard from "@/components/results/SourcesCard";
import { Inbox, Zap } from "lucide-react";

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        background: "hsla(222, 35%, 10%, 0.85)",
        border: "1px dashed hsla(222, 25%, 20%, 0.8)",
        borderRadius: "20px",
        padding: "4rem 2rem",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
        minHeight: "400px",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "20px",
          background: "hsla(221, 83%, 53%, 0.08)",
          border: "1px solid hsla(221, 83%, 53%, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Inbox size={32} color="hsl(221, 83%, 53%)" />
      </div>

      <h3 style={{ color: "hsl(220, 20%, 85%)", fontWeight: 700 }}>
        Ready to analyze your document
      </h3>

      <p style={{ color: "hsl(220, 8%, 48%)", fontSize: "0.875rem" }}>
        Upload a file or paste text, then click <strong>Analyze Document</strong>.
      </p>

      <div style={{ padding: "0.625rem 1rem", borderRadius: "10px" }}>
        <Zap size={13} color="hsl(142, 71%, 55%)" />
      </div>
    </motion.div>
  );
}

function AnalyzingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        background: "hsla(222, 35%, 10%, 0.85)",
        borderRadius: "20px",
        padding: "3rem 2rem",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2rem",
        minHeight: "400px",
        justifyContent: "center",
      }}
    >
      <h3 style={{ color: "hsl(220, 20%, 90%)", fontWeight: 700 }}>
        AI is analyzing your document
      </h3>
    </motion.div>
  );
}

export default function ResultsPanel({ currentDoc, analyzing, aiResult }) {
  const result = aiResult ?? currentDoc?.result ?? null;

  return (
    <AnimatePresence mode="wait">
      {result ? (
        <motion.div
          key="results"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <SummaryCard result={result} />
          <ChecklistCard result={result} />
          <DeadlinesCard result={result} />
          <QuestionsCard result={result} />
          <ConfidenceCard result={result} />
          <SourcesCard result={result} />
        </motion.div>
      ) : analyzing ? (
        <AnalyzingState key="analyzing" />
      ) : (
        <EmptyState key="empty" />
      )}
    </AnimatePresence>
  );
}