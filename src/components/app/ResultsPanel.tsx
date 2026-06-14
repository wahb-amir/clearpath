"use client";
import { motion, AnimatePresence } from "framer-motion";
import { SampleDocument } from "@/lib/types";
import SummaryCard from "@/components/results/SummaryCard";
import ChecklistCard from "@/components/results/ChecklistCard";
import DeadlinesCard from "@/components/results/DeadlinesCard";
import QuestionsCard from "@/components/results/QuestionsCard";
import ConfidenceCard from "@/components/results/ConfidenceCard";
import SourcesCard from "@/components/results/SourcesCard";
import { Inbox, Zap } from "lucide-react";

interface ResultsPanelProps {
  currentDoc: SampleDocument | null;
  analyzing: boolean;
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
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
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
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
        <Inbox size={32} color="hsl(221, 83%, 53%)" strokeWidth={1.5} />
      </motion.div>

      <div>
        <h3 style={{ color: "hsl(220, 20%, 85%)", fontFamily: "Outfit, sans-serif", fontWeight: 700, fontSize: "1.25rem", marginBottom: "0.625rem" }}>
          Ready to analyze your document
        </h3>
        <p style={{ color: "hsl(220, 8%, 48%)", fontSize: "0.875rem", lineHeight: 1.7, maxWidth: "320px" }}>
          Upload a file, paste your document text, or load one of our sample documents — then click <strong style={{ color: "hsl(221, 89%, 70%)" }}>Analyze Document</strong>.
        </p>
      </div>

      {/* Sample doc preview cards */}
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
            <span style={{ fontSize: "1rem" }}>{item.icon}</span>
            <span style={{ color: "hsl(220, 10%, 60%)", fontSize: "0.78rem" }}>{item.label}</span>
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
        <span style={{ color: "hsl(142, 71%, 60%)", fontSize: "0.78rem" }}>
          Works with school notices, letters, forms &amp; screenshots
        </span>
      </div>
    </motion.div>
  );
}

function AnalyzingState() {
  const steps = [
    "Reading document structure...",
    "Extracting key information...",
    "Identifying deadlines...",
    "Generating action plan...",
    "Checking confidence levels...",
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        background: "hsla(222, 35%, 10%, 0.85)",
        border: "1px solid hsla(221, 83%, 53%, 0.2)",
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
      {/* Animated logo */}
      <div style={{ position: "relative" }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            border: "3px solid hsla(221, 83%, 53%, 0.15)",
            borderTopColor: "hsl(221, 83%, 53%)",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        />
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "hsla(221, 83%, 53%, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Zap size={24} color="hsl(191, 100%, 50%)" />
        </div>
      </div>

      <div>
        <h3 style={{ color: "hsl(220, 20%, 90%)", fontFamily: "Outfit, sans-serif", fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.5rem" }}>
          AI is analyzing your document
        </h3>
        <p style={{ color: "hsl(220, 8%, 50%)", fontSize: "0.8rem" }}>
          This usually takes just a moment...
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: "300px" }}>
        {steps.map((step, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.35 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "8px",
              background: "hsla(222, 40%, 7%, 0.5)",
              border: "1px solid hsla(222, 25%, 14%, 0.6)",
            }}
          >
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "hsl(221, 83%, 53%)",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "hsl(220, 10%, 60%)", fontSize: "0.78rem" }}>{step}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default function ResultsPanel({ currentDoc, analyzing }: ResultsPanelProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  return (
    <div>
      <AnimatePresence mode="wait">
        {analyzing ? (
          <AnalyzingState key="analyzing" />
        ) : !currentDoc ? (
          <EmptyState key="empty" />
        ) : (
          <motion.div
            key={currentDoc.id}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
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
    </div>
  );
}
