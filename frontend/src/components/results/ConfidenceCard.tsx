"use client";
import { motion } from "framer-motion";
import { AnalysisResult, ConfidenceLevel } from "@/lib/types";
import { ShieldAlert, ShieldCheck, AlertCircle, Info } from "lucide-react";

interface ConfidenceCardProps {
  result: AnalysisResult;
}

function ConfidenceBar({ level }: { level: ConfidenceLevel }) {
  const config = {
    high: { width: "90%", color: "hsl(142, 71%, 50%)", label: "High" },
    medium: { width: "58%", color: "hsl(38, 92%, 55%)", label: "Medium" },
    low: { width: "28%", color: "hsl(0, 84%, 65%)", label: "Low" },
  };
  const c = config[level];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
      <div
        style={{
          flex: 1,
          height: "5px",
          background: "hsla(222, 25%, 16%, 0.6)",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: c.width }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
          style={{ height: "100%", background: c.color, borderRadius: "999px" }}
        />
      </div>
      <span
        style={{
          fontSize: "0.72rem",
          fontWeight: 700,
          color: c.color,
          width: "46px",
          textAlign: "right",
        }}
      >
        {c.label}
      </span>
    </div>
  );
}

export default function ConfidenceCard({ result }: ConfidenceCardProps) {
  const hasLowConfidence = result.confidence.some((c) => c.level === "low");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "hsla(222, 35%, 10%, 0.85)",
        border: "1px solid hsla(222, 25%, 16%, 0.8)",
        borderRadius: "16px",
        padding: "1.5rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1.125rem" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "hsla(221, 83%, 53%, 0.1)",
            border: "1px solid hsla(221, 83%, 53%, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShieldAlert size={16} color="hsl(191, 70%, 70%)" />
        </div>
        <div>
          <div style={{ color: "hsl(220, 10%, 55%)", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.15rem" }}>
            AI Confidence
          </div>
          <div style={{ color: "hsl(220, 20%, 90%)", fontWeight: 700, fontFamily: "Outfit, sans-serif", fontSize: "1rem" }}>
            How Sure Is the AI?
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {result.confidence.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.07 }}
            style={{
              padding: "0.875rem 1rem",
              borderRadius: "10px",
              background: item.level === "low" ? "hsla(0, 84%, 60%, 0.05)" : "hsla(222, 40%, 7%, 0.5)",
              border: `1px solid ${item.level === "low" ? "hsla(0, 84%, 60%, 0.15)" : "hsla(222, 25%, 14%, 0.8)"}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              {item.level === "high" ? (
                <ShieldCheck size={13} color="hsl(142, 71%, 50%)" />
              ) : item.level === "medium" ? (
                <AlertCircle size={13} color="hsl(38, 92%, 55%)" />
              ) : (
                <AlertCircle size={13} color="hsl(0, 84%, 65%)" />
              )}
              <span style={{ color: "hsl(220, 12%, 80%)", fontSize: "0.82rem", fontWeight: 600 }}>
                {item.label}
              </span>
            </div>
            <ConfidenceBar level={item.level} />
            <p style={{ color: "hsl(220, 8%, 48%)", fontSize: "0.76rem", marginTop: "0.5rem", lineHeight: 1.5 }}>
              {item.note}
            </p>
          </motion.div>
        ))}
      </div>

      {hasLowConfidence && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            marginTop: "1rem",
            padding: "0.875rem 1rem",
            borderRadius: "10px",
            background: "hsla(38, 92%, 50%, 0.07)",
            border: "1px solid hsla(38, 92%, 50%, 0.18)",
            display: "flex",
            gap: "0.625rem",
          }}
        >
          <Info size={14} color="hsl(38, 92%, 55%)" style={{ flexShrink: 0, marginTop: "1px" }} />
          <p style={{ color: "hsl(38, 92%, 65%)", fontSize: "0.78rem", margin: 0, lineHeight: 1.55 }}>
            Some items have low confidence. Please verify those directly with the issuing organization before taking action.
          </p>
        </motion.div>
      )}

      <div
        style={{
          marginTop: "0.875rem",
          padding: "0.75rem 1rem",
          borderRadius: "10px",
          background: "hsla(222, 35%, 8%, 0.5)",
          border: "1px solid hsla(222, 25%, 14%, 0.6)",
        }}
      >
        <p style={{ color: "hsl(220, 8%, 45%)", fontSize: "0.75rem", margin: 0, lineHeight: 1.55 }}>
          ⚠️ <strong style={{ color: "hsl(220, 8%, 55%)" }}>Warning:</strong> {result.warning}
        </p>
      </div>
    </motion.div>
  );
}
