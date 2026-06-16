"use client";

import { motion, AnimatePresence } from "framer-motion";
import SummaryCard from "@/components/results/SummaryCard";
import ChecklistCard from "@/components/results/ChecklistCard";
import DeadlinesCard from "@/components/results/DeadlinesCard";
import QuestionsCard from "@/components/results/QuestionsCard";
import ConfidenceCard from "@/components/results/ConfidenceCard";
import SourcesCard from "@/components/results/SourcesCard";
import { Inbox, Zap } from "lucide-react";

/* ---------------- EMPTY STATE ---------------- */

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

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { icon: "🏫", label: "Attendance Warning" },
          { icon: "🎓", label: "Scholarship Notice" },
          { icon: "🏠", label: "Housing Assistance" },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0.875rem",
              borderRadius: "10px",
              background: "hsla(222, 35%, 12%, 0.8)",
              border: "1px solid hsla(222, 25%, 16%, 0.6)",
            }}
          >
            <span>{item.icon}</span>
            <span style={{ fontSize: "0.78rem", color: "hsl(220, 10%, 60%)" }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "0.625rem 1rem",
          borderRadius: "10px",
          background: "hsla(142, 71%, 45%, 0.07)",
          border: "1px solid hsla(142, 71%, 45%, 0.15)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <Zap size={13} color="hsl(142, 71%, 55%)" />
        <span style={{ fontSize: "0.78rem", color: "hsl(142, 71%, 60%)" }}>
          Works with notices, forms & screenshots
        </span>
      </div>
    </motion.div>
  );
}

/* ---------------- ANALYZING STATE ---------------- */

function AnalyzingState() {
  const steps = [
    "Reading document...",
    "Extracting data...",
    "Finding deadlines...",
    "Generating plan...",
    "Checking confidence...",
  ];

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
      <div style={{ position: "relative", width: 64, height: 64 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "3px solid hsla(221, 83%, 53%, 0.15)",
            borderTopColor: "hsl(221, 83%, 53%)",
            animation: "spin 1.5s linear infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 64,
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Zap size={24} color="hsl(191, 100%, 50%)" />
        </div>
      </div>

      <h3 style={{ color: "hsl(220, 20%, 90%)", fontWeight: 700 }}>
        AI is analyzing your document
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: "300px" }}>
        {steps.map((step) => (
          <div
            key={step}
            style={{
              display: "flex",
              gap: "0.6rem",
              padding: "0.5rem",
              borderRadius: "8px",
              background: "hsla(222, 40%, 7%, 0.5)",
            }}
          >
            <span style={{ color: "hsl(221, 83%, 53%)" }}>•</span>
            <span style={{ fontSize: "0.78rem", color: "hsl(220, 10%, 60%)" }}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ---------------- MAIN PANEL ---------------- */

export default function ResultsPanel({ currentDoc, analyzing }) {
  return (
    <AnimatePresence mode="wait">
      {analyzing ? (
        <AnalyzingState key="analyzing" />
      ) : !currentDoc ? (
        <EmptyState key="empty" />
      ) : (
        <motion.div
          key="results"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <SummaryCard result={currentDoc.result} />
          <ChecklistCard result={currentDoc.result} />
          <DeadlinesCard result={currentDoc.result} />
          <QuestionsCard result={currentDoc.result} />
          <ConfidenceCard result={currentDoc.result} />
          <SourcesCard result={currentDoc.result} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}