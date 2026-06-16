"use client";

import { motion } from "framer-motion";
import { Clock, Calendar, AlertTriangle } from "lucide-react";
import UrgencyBadge from "@/components/ui/UrgencyBadge";

function getDaysLabel(days) {
  if (days === undefined || days === null) return null;
  if (days <= 0) return { text: "Past due", color: "hsl(0, 84%, 65%)" };
  if (days === 1) return { text: "Tomorrow!", color: "hsl(0, 84%, 65%)" };
  if (days <= 3) return { text: `${days} days left`, color: "hsl(0, 84%, 65%)" };
  if (days <= 7) return { text: `${days} days left`, color: "hsl(38, 92%, 55%)" };
  return { text: `${days} days`, color: "hsl(220, 10%, 55%)" };
}

export default function DeadlinesCard({ result }) {
  const deadlines = result?.deadlines || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12 }}
      style={{
        background: "hsla(222, 35%, 10%, 0.85)",
        border: "1px solid hsla(222, 25%, 16%, 0.8)",
        borderRadius: "16px",
        padding: "1.5rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", gap: "0.625rem", marginBottom: "1.25rem" }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "hsla(38, 92%, 50%, 0.1)",
            border: "1px solid hsla(38, 92%, 50%, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Clock size={16} color="hsl(38, 92%, 55%)" />
        </div>

        <div>
          <div
            style={{
              color: "hsl(220, 10%, 55%)",
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Key Deadlines
          </div>

          <div
            style={{
              color: "hsl(220, 20%, 90%)",
              fontWeight: 700,
              fontFamily: "Outfit, sans-serif",
              fontSize: "1rem",
            }}
          >
            Dates You Must Not Miss
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {deadlines.map((deadline, i) => {
          const daysInfo = getDaysLabel(deadline?.daysUntil);
          const isUrgent = (deadline?.daysUntil ?? 999) <= 7;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                padding: "1rem 1.125rem",
                borderRadius: "12px",
                background: isUrgent
                  ? "hsla(0, 84%, 60%, 0.06)"
                  : "hsla(222, 40%, 7%, 0.5)",
                border: isUrgent
                  ? "1px solid hsla(0, 84%, 60%, 0.2)"
                  : "1px solid hsla(222, 25%, 14%, 0.8)",
                position: "relative",
              }}
            >
              {/* urgency bar */}
              {isUrgent && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background:
                      "linear-gradient(180deg, hsl(0, 84%, 60%), hsl(38, 92%, 55%))",
                    borderRadius: "12px 0 0 12px",
                  }}
                />
              )}

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isUrgent && (
                      <AlertTriangle size={13} color="hsl(0, 84%, 65%)" />
                    )}
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "hsl(220, 12%, 80%)",
                      }}
                    >
                      {deadline?.label}
                    </p>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={12} color="hsl(220, 10%, 50%)" />
                      <span style={{ fontSize: "0.78rem", color: "hsl(220, 10%, 55%)" }}>
                        {deadline?.date}
                      </span>
                    </div>

                    {daysInfo && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: daysInfo.color,
                          background: "rgba(255,255,255,0.05)",
                          padding: "2px 6px",
                          borderRadius: 6,
                        }}
                      >
                        {daysInfo.text}
                      </span>
                    )}
                  </div>
                </div>

                <UrgencyBadge
                  level={deadline?.urgency}
                  size="sm"
                  showIcon={false}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}