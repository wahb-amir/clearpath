"use client";

import { motion } from "framer-motion";
import UrgencyBadge from "@/components/ui/UrgencyBadge";
import { FileText, Sparkles, Info } from "lucide-react";

export default function SummaryCard({ result }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "hsla(222, 35%, 10%, 0.85)",
        border: "1px solid hsla(222, 25%, 16%, 0.8)",
        borderRadius: "16px",
        padding: "1.5rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background:
            "linear-gradient(90deg, hsl(221, 83%, 53%), hsl(221, 83%, 53%))",
          borderRadius: "16px 16px 0 0",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "1rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "hsla(221, 83%, 53%, 0.12)",
              border: "1px solid hsla(221, 83%, 53%, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={16} color="hsl(191, 100%, 50%)" />
          </div>

          <div>
            <div
              style={{
                color: "hsl(220, 10%, 55%)",
                fontSize: "0.72rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "0.2rem",
              }}
            >
              AI Summary
            </div>

            <div
              style={{
                color: "hsl(220, 20%, 90%)",
                fontWeight: 700,
                fontSize: "1rem",
                fontFamily: "Outfit, sans-serif",
                letterSpacing: "-0.01em",
              }}
            >
              {result?.title}
            </div>
          </div>
        </div>

        <UrgencyBadge level={result?.urgency} size="md" />
      </div>

      {/* Summary box */}
      <div
        style={{
          background: "hsla(222, 40%, 7%, 0.6)",
          border: "1px solid hsla(222, 25%, 14%, 0.8)",
          borderRadius: "10px",
          padding: "1rem 1.125rem",
          marginBottom: "1rem",
        }}
      >
        <p
          style={{
            color: "hsl(220, 12%, 78%)",
            fontSize: "0.9rem",
            lineHeight: 1.75,
            margin: 0,
          }}
        >
          {result?.summary}
        </p>
      </div>

      {/* Footer info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <FileText size={13} color="hsl(220, 10%, 50%)" />
          <span style={{ color: "hsl(220, 10%, 55%)", fontSize: "0.78rem" }}>
            {result?.documentType}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.25rem 0.625rem",
            borderRadius: "6px",
            background: "hsla(221, 83%, 53%, 0.07)",
            border: "1px solid hsla(221, 83%, 53%, 0.12)",
          }}
        >
          
        </div>
      </div>
    </motion.div>
  );
}
