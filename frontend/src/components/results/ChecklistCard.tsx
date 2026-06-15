"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { AnalysisResult } from "@/lib/types";
import { CheckCircle2, Circle, ListChecks } from "lucide-react";

interface ChecklistCardProps {
  result: AnalysisResult;
}

export default function ChecklistCard({ result }: ChecklistCardProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const progress = (checked.size / result.actions.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "hsla(222, 35%, 10%, 0.85)",
        border: "1px solid hsla(222, 25%, 16%, 0.8)",
        borderRadius: "16px",
        padding: "1.5rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.125rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "hsla(142, 71%, 45%, 0.1)",
              border: "1px solid hsla(142, 71%, 45%, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ListChecks size={16} color="hsl(142, 71%, 50%)" />
          </div>
          <div>
            <div style={{ color: "hsl(220, 10%, 55%)", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.15rem" }}>
              Action Items
            </div>
            <div style={{ color: "hsl(220, 20%, 90%)", fontWeight: 700, fontFamily: "Outfit, sans-serif", fontSize: "1rem" }}>
              What You Need To Do
            </div>
          </div>
        </div>
        <div
          style={{
            background: "hsla(142, 71%, 45%, 0.1)",
            border: "1px solid hsla(142, 71%, 45%, 0.2)",
            borderRadius: "999px",
            padding: "0.25rem 0.625rem",
            color: "hsl(142, 71%, 55%)",
            fontSize: "0.75rem",
            fontWeight: 700,
          }}
        >
          {checked.size}/{result.actions.length}
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: "4px",
          background: "hsla(222, 25%, 16%, 0.6)",
          borderRadius: "999px",
          marginBottom: "1.125rem",
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            height: "100%",
            background: "linear-gradient(90deg, hsl(142, 71%, 50%), hsl(142, 60%, 60%))",
            borderRadius: "999px",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {result.actions.map((action, i) => (
          <motion.button
            key={i}
            onClick={() => toggle(i)}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ x: 3 }}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              borderRadius: "10px",
              background: checked.has(i) ? "hsla(142, 71%, 45%, 0.07)" : "hsla(222, 40%, 7%, 0.5)",
              border: `1px solid ${checked.has(i) ? "hsla(142, 71%, 45%, 0.2)" : "hsla(222, 25%, 14%, 0.8)"}`,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s ease",
              width: "100%",
            }}
          >
            <div style={{ flexShrink: 0, marginTop: "1px" }}>
              {checked.has(i) ? (
                <CheckCircle2 size={18} color="hsl(142, 71%, 50%)" />
              ) : (
                <Circle size={18} color="hsl(220, 10%, 40%)" />
              )}
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", flex: 1 }}>
              <span
                style={{
                  background: "hsla(221, 83%, 53%, 0.12)",
                  color: "hsl(191, 100%, 50%)",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  padding: "0.15rem 0.45rem",
                  borderRadius: "5px",
                  flexShrink: 0,
                  marginTop: "1px",
                }}
              >
                {i + 1}
              </span>
              <p
                style={{
                  color: checked.has(i) ? "hsl(220, 10%, 50%)" : "hsl(220, 12%, 78%)",
                  fontSize: "0.875rem",
                  lineHeight: 1.55,
                  margin: 0,
                  textDecoration: checked.has(i) ? "line-through" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {action}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
