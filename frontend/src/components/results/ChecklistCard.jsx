"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle, ListChecks } from "lucide-react";

export default function ChecklistCard({ result, onToggleAction }) {
  const actions = result?.actions || [];

  // Derive completed counts directly from the backend object state parameters
  const completedCount = actions.filter((a) => a.completed).length;
  const progress =
    actions.length > 0 ? (completedCount / actions.length) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "hsla(222, 35%, 10%, 0.85)",
        border: "1px solid hsla(222, 25%, 16%, 0.8)",
        borderRadius: "16px",
        padding: "1.5rem",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
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
            <div
              style={{
                fontSize: "0.7rem",
                color: "hsl(220,10%,55%)",
                fontWeight: 600,
              }}
            >
              Action Items
            </div>
            <div
              style={{
                fontWeight: 700,
                color: "hsl(220,20%,90%)",
              }}
            >
              What You Need To Do
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "hsl(142,71%,55%)",
            background: "hsla(142,71%,45%,0.1)",
            padding: "0.25rem 0.6rem",
            borderRadius: 999,
          }}
        >
          {completedCount}/{actions.length}
        </div>
      </div>

      {/* PROGRESS */}
      <div
        style={{
          height: 4,
          background: "hsla(222,25%,16%,0.6)",
          borderRadius: 999,
          marginBottom: 16,
        }}
      >
        <motion.div
          animate={{ width: `${progress}%` }}
          style={{
            height: "100%",
            background:
              "linear-gradient(90deg, hsl(142,71%,50%), hsl(142,60%,60%))",
          }}
        />
      </div>

      {/* LIST */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {actions.map((action, i) => {
          // Read completion flag directly from data record structure
          const isChecked = !!action?.completed;

          return (
            <motion.button
              key={i}
              onClick={() => onToggleAction?.(i)}
              whileHover={{ x: 3 }}
              style={{
                display: "flex",
                gap: 12,
                padding: "0.75rem 1rem",
                borderRadius: 10,
                width: "100%",
                textAlign: "left",
                background: isChecked
                  ? "hsla(142,71%,45%,0.07)"
                  : "hsla(222,40%,7%,0.5)",
                border: isChecked
                  ? "1px solid hsla(142,71%,45%,0.2)"
                  : "1px solid hsla(222,25%,14%,0.8)",
                cursor: "pointer",
                alignItems: "flex-start",
              }}
            >
              <div style={{ marginTop: "2px", flexShrink: 0 }}>
                {isChecked ? (
                  <CheckCircle2 size={18} color="hsl(142,71%,50%)" />
                ) : (
                  <Circle size={18} color="hsl(220,10%,40%)" />
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  width: "100%",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "hsl(191,100%,50%)",
                      marginTop: "1px",
                    }}
                  >
                    {i + 1}
                  </span>

                  {/* FIXED HERE: Safely extract action.text property string payload wrapper */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: isChecked
                        ? "hsl(220,10%,50%)"
                        : "hsl(220,12%,78%)",
                      textDecoration: isChecked ? "line-through" : "none",
                      lineHeight: "1.4",
                    }}
                  >
                    {action?.text || ""}
                  </p>
                </div>

                {/* ADDITIONAL SPEC INTERACTION META DETAILS */}
                {(action?.supporting_evidence || action?.priority) && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      paddingLeft: 20,
                      flexWrap: "wrap",
                    }}
                  >
                    {action?.priority && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          fontFamily: "monospace",
                          background:
                            action.priority === "high"
                              ? "hsla(350, 70%, 50%, 0.15)"
                              : "hsla(222, 25%, 20%, 0.6)",
                          color:
                            action.priority === "high"
                              ? "hsl(350, 80%, 65%)"
                              : "hsl(220, 10%, 60%)",
                          border:
                            action.priority === "high"
                              ? "1px solid hsla(350, 70%, 50%, 0.25)"
                              : "1px solid hsla(222, 25%, 25%, 0.4)",
                        }}
                      >
                        {action.priority}
                      </span>
                    )}

                    {action?.supporting_evidence && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "hsl(220, 10%, 45%)",
                          fontFamily: "monospace",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}
                        title={action.supporting_evidence}
                      >
                        Context: {action.supporting_evidence}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
