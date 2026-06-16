"use client";

import { motion } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  Info,
} from "lucide-react";

function ConfidenceBar({ level }) {
  const config = {
    high: { width: "90%", color: "hsl(142, 71%, 50%)", label: "High" },
    medium: { width: "58%", color: "hsl(38, 92%, 55%)", label: "Medium" },
    low: { width: "28%", color: "hsl(0, 84%, 65%)", label: "Low" },
  };

  const c = config[level] || config.medium;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          flex: 1,
          height: 5,
          background: "hsla(222, 25%, 16%, 0.6)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: c.width }}
          transition={{ duration: 0.7 }}
          style={{
            height: "100%",
            background: c.color,
            borderRadius: 999,
          }}
        />
      </div>

      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: c.color,
          width: 50,
          textAlign: "right",
        }}
      >
        {c.label}
      </span>
    </div>
  );
}

export default function ConfidenceCard({ result }) {
  const confidence = result?.confidence || [];

  const hasLowConfidence = confidence.some(
    (c) => c.level === "low"
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "hsla(222, 35%, 10%, 0.85)",
        border: "1px solid hsla(222, 25%, 16%, 0.8)",
        borderRadius: 16,
        padding: 24,
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "hsla(221,83%,53%,0.1)",
            border: "1px solid hsla(221,83%,53%,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShieldAlert size={16} color="hsl(191,70%,70%)" />
        </div>

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "hsl(220,10%,55%)",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            AI Confidence
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "hsl(220,20%,90%)",
            }}
          >
            How Sure Is the AI?
          </div>
        </div>
      </div>

      {/* LIST */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {confidence.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            style={{
              padding: 14,
              borderRadius: 10,
              background:
                item.level === "low"
                  ? "hsla(0,84%,60%,0.05)"
                  : "hsla(222,40%,7%,0.5)",
              border:
                item.level === "low"
                  ? "1px solid hsla(0,84%,60%,0.15)"
                  : "1px solid hsla(222,25%,14%,0.8)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              {item.level === "high" ? (
                <ShieldCheck size={14} color="hsl(142,71%,50%)" />
              ) : (
                <AlertCircle
                  size={14}
                  color={
                    item.level === "medium"
                      ? "hsl(38,92%,55%)"
                      : "hsl(0,84%,65%)"
                  }
                />
              )}

              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "hsl(220,12%,80%)",
                }}
              >
                {item.label}
              </span>
            </div>

            <ConfidenceBar level={item.level} />

            <p
              style={{
                fontSize: 12,
                marginTop: 6,
                color: "hsl(220,8%,48%)",
                lineHeight: 1.5,
              }}
            >
              {item.note}
            </p>
          </motion.div>
        ))}
      </div>

      {/* WARNING */}
      {hasLowConfidence && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            background: "hsla(38,92%,50%,0.07)",
            border: "1px solid hsla(38,92%,50%,0.18)",
            display: "flex",
            gap: 8,
          }}
        >
          <Info size={14} color="hsl(38,92%,55%)" />
          <p style={{ fontSize: 12, margin: 0, color: "hsl(38,92%,65%)" }}>
            Some items are uncertain. Double-check with official sources.
          </p>
        </motion.div>
      )}

      {/* FOOTNOTE */}
      <div
        style={{
          marginTop: 12,
          padding: 10,
          borderRadius: 10,
          background: "hsla(222,35%,8%,0.5)",
          border: "1px solid hsla(222,25%,14%,0.6)",
        }}
      >
        <p style={{ fontSize: 11, margin: 0, color: "hsl(220,8%,45%)" }}>
          ⚠️ {result?.warning}
        </p>
      </div>
    </motion.div>
  );
}