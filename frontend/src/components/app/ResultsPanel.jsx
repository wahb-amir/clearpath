"use client";

import { motion, AnimatePresence } from "framer-motion";
import SummaryCard from "@/components/results/SummaryCard";
import ChecklistCard from "@/components/results/ChecklistCard";
import DeadlinesCard from "@/components/results/DeadlinesCard";
import QuestionsCard from "@/components/results/QuestionsCard";
import ConfidenceCard from "@/components/results/ConfidenceCard";
import SourcesCard from "@/components/results/SourcesCard";
import { Inbox, Zap, Loader2 } from "lucide-react";

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
        Upload a file or paste text, then click{" "}
        <strong>Analyze Document</strong>.
      </p>

      <div style={{ padding: "0.625rem 1rem", borderRadius: "10px" }}>
        <Zap size={13} color="hsl(142, 71%, 55%)" />
      </div>
    </motion.div>
  );
}

// Utility component for reusable skeleton bars
function SkeletonBlock({
  width,
  height = "12px",
  borderRadius = "6px",
  opacity = 0.2,
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: `hsla(220, 20%, 60%, ${opacity})`,
      }}
    />
  );
}

// Wrapper for the pulsing card effect
function SkeletonCard({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: [0.3, 0.7, 0.3], y: 0 }}
      transition={{
        opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        y: { duration: 0.4 },
      }}
      style={{
        background: "hsla(222, 35%, 12%, 0.6)",
        border: "1px solid hsla(222, 25%, 20%, 0.4)",
        borderRadius: "20px",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      {children}
    </motion.div>
  );
}

function AnalyzingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {/* Visual Indicator of Progress */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.5rem 1rem",
          marginBottom: "0.5rem",
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 size={18} color="hsl(221, 83%, 53%)" />
        </motion.div>
        <span
          style={{
            color: "hsl(221, 83%, 65%)",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          Extracting intelligence...
        </span>
      </div>

      {/* Summary Skeleton Layout */}
      <SkeletonCard>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <SkeletonBlock
            width="40px"
            height="40px"
            borderRadius="12px"
            opacity={0.15}
          />
          <SkeletonBlock width="140px" height="16px" opacity={0.3} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            marginTop: "0.5rem",
          }}
        >
          <SkeletonBlock width="100%" />
          <SkeletonBlock width="95%" />
          <SkeletonBlock width="80%" />
        </div>
      </SkeletonCard>

      {/* Checklist Skeleton Layout */}
      <SkeletonCard>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <SkeletonBlock
            width="40px"
            height="40px"
            borderRadius="12px"
            opacity={0.15}
          />
          <SkeletonBlock width="120px" height="16px" opacity={0.3} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            marginTop: "0.5rem",
          }}
        >
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <SkeletonBlock
              width="20px"
              height="20px"
              borderRadius="6px"
              opacity={0.15}
            />
            <SkeletonBlock width="75%" />
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <SkeletonBlock
              width="20px"
              height="20px"
              borderRadius="6px"
              opacity={0.15}
            />
            <SkeletonBlock width="60%" />
          </div>
        </div>
      </SkeletonCard>

      {/* Deadlines Skeleton Layout */}
      <SkeletonCard>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <SkeletonBlock
            width="40px"
            height="40px"
            borderRadius="12px"
            opacity={0.15}
          />
          <SkeletonBlock width="160px" height="16px" opacity={0.3} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            marginTop: "0.5rem",
          }}
        >
          <SkeletonBlock width="40%" />
        </div>
      </SkeletonCard>
    </motion.div>
  );
}

export default function ResultsPanel({ currentDoc, analyzing, aiResult }) {
  const rawResult = aiResult ?? currentDoc?.result ?? null;

  // 1. Convert decimal scores to "high", "medium", "low"
  const getConfidenceLevel = (score) => {
    if (score >= 0.8) return "high";
    if (score >= 0.5) return "medium";
    return "low";
  };

  // 2. Format the aiConfidence object into the array the ConfidenceCard expects
  const formatConfidence = (aiConfidence) => {
    if (!aiConfidence) return [];

    // Convert object { actions: 0.8, overall: 0.8 } into array of objects
    return Object.entries(aiConfidence)
      .filter(([key, score]) => score > 0) // Hide categories with 0 confidence (like deadlines)
      .map(([key, score]) => ({
        label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize first letter
        level: getConfidenceLevel(score),
        note: `Scored ${score * 100}% based on document analysis.`,
      }));
  };

  // 3. The Data Adapter: Reshape the backend JSON for the frontend
const normalizedResult = rawResult
  ? (() => {
      const dataSource = rawResult.payload ? rawResult.payload : rawResult;

      return {
        ...rawResult, 
        
        title: rawResult.title || dataSource.title || "Document Analysis",

        // Keep action items as full objects so ChecklistCard can read action.text,
        // action.completed, action.priority, etc. If the item is a bare string
        // (older API shape), normalise it into the object shape expected by the card.
        actions: dataSource.actionItems?.map((item) => {
          if (typeof item === "string") {
            return { text: item, completed: false, priority: "medium", supporting_evidence: "" };
          }
          return item ?? {};
        }).filter((item) => item?.text) || [],

        // Remap keys to match card expectations
        deadlines: dataSource.keyDeadlines || [],
        questions: dataSource.questionsToAsk || [],
        sources: dataSource.trustedSources || [],

        // Safely pass the localized aiConfidence object to your formatter
        confidence: formatConfidence(dataSource.aiConfidence),
      };
    })()
  : null;

  return (
    <AnimatePresence mode="wait">
      {normalizedResult ? (
        <motion.div
          key="results"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <SummaryCard result={normalizedResult} />
          {/* Only render cards if they actually have data to show */}
          {normalizedResult.actions?.length > 0 && (
            <ChecklistCard result={normalizedResult} />
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
      ) : analyzing ? (
        <AnalyzingState key="analyzing" />
      ) : (
        <EmptyState key="empty" />
      )}
    </AnimatePresence>
  );
}
