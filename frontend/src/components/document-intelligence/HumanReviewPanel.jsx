"use client";

import { motion, AnimatePresence } from "framer-motion";
import { UserCheck, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { useState } from "react";

// ── MOCK DATA ────────────────────────────────────────────────────────
const mockHumanReviewData = {
  required: true,
  reason: "needs review: Missing official translation verification for out-of-state transcripts.",
  gaps: [
    "Whether the 2025 chemistry credits satisfy the new state laboratory requirements.",
    "The exact stamp or seal verification from the previous school district.",
    "Discrepancy in the student's middle name spelling between the ID and the transcript."
  ],
  prep_questions: [
    "Is my 2025 chemistry class considered a full 'laboratory science' credit under the updated state guidelines?",
    "Do you require an original notarized copy of my previous transcripts, or is the digital copy sufficient?",
    "Can we update my official student record to match the exact spelling on my state identification?"
  ]
};

// ── MAIN PREVIEW PAGE ────────────────────────────────────────────────
export default function PreviewPage() {
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0d0e12",
      color: "#f3f4f6",
      padding: "2rem",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      fontFamily: "system-ui, sans-serif"
    }}>
      <div style={{ width: "100%", maxWidth: "600px" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 500, marginBottom: "1.5rem", color: "#9ca3af" }}>
          Document Processing Preview
        </h1>
        
        {/* Injecting the HumanReviewPanel with the mock data */}
        <HumanReviewPanel humanReview={mockHumanReviewData} />
      </div>
    </div>
  );
}

// ── YOUR ORIGINAL COMPONENT ──────────────────────────────────────────
function HumanReviewPanel({ humanReview }) {
  const [expanded, setExpanded] = useState(true);

  if (!humanReview?.required) return null;

  const gaps = humanReview.gaps ?? [];
  const prepQuestions = humanReview.prep_questions ?? [];
  const reason = (humanReview.reason ?? "")
    .replace(/^needs review:\s*/i, "")
    .trim() || "A human expert should verify this document's details.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{
        borderRadius: "14px",
        overflow: "hidden",
        border: "1px solid hsla(38, 92%, 55%, 0.25)",
        background: "hsla(36, 90%, 50%, 0.04)",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          padding: "0.875rem 1.125rem",
          background: "hsla(36, 90%, 50%, 0.06)",
          border: "none",
          borderBottom: expanded
            ? "1px solid hsla(38, 92%, 55%, 0.15)"
            : "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: "hsla(38, 92%, 55%, 0.12)",
            border: "1px solid hsla(38, 92%, 55%, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <UserCheck size={15} color="hsl(38, 92%, 65%)" />
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "0.68rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "hsl(38, 80%, 55%)",
              marginBottom: "0.1rem",
            }}
          >
            Human-in-the-Loop
          </div>
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "hsl(38, 90%, 85%)",
              fontFamily: "Outfit, sans-serif",
            }}
          >
            Human Review Required
          </div>
        </div>

        <ChevronRight
          size={14}
          color="hsl(38, 60%, 50%)"
          style={{
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "1rem 1.125rem", display: "flex", flexDirection: "column", gap: "1.125rem" }}>

              {/* Reason Note (Injected based on the custom string cleaning logic) */}
              <div style={{ fontSize: "0.85rem", color: "hsl(38, 90%, 80%)", lineHeight: 1.4, opacity: 0.9 }}>
                <strong>Reason:</strong> {reason}
              </div>

              {/* Gaps section */}
              {gaps.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color: "hsl(220, 10%, 45%)",
                      marginBottom: "0.55rem",
                    }}
                  >
                    This notice does not explain:
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    {gaps.map((gap, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.5rem",
                        }}
                      >
                        <AlertTriangle
                          size={12}
                          color="hsl(38, 92%, 55%)"
                          style={{ flexShrink: 0, marginTop: "2px" }}
                        />
                        <span
                          style={{
                            fontSize: "0.82rem",
                            color: "hsl(220, 10%, 65%)",
                            lineHeight: 1.5,
                          }}
                        >
                          {gap}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prep questions section */}
              {prepQuestions.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color: "hsl(220, 10%, 45%)",
                      marginBottom: "0.55rem",
                    }}
                  >
                    Questions prepared for you:
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    {prepQuestions.map((q, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 + i * 0.04 }}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.5rem",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "8px",
                          background: "hsla(142, 60%, 40%, 0.07)",
                          border: "1px solid hsla(142, 60%, 40%, 0.15)",
                        }}
                      >
                        <CheckCircle2
                          size={13}
                          color="hsl(142, 60%, 55%)"
                          style={{ flexShrink: 0, marginTop: "1px" }}
                        />
                        <span
                          style={{
                            fontSize: "0.82rem",
                            color: "hsl(220, 12%, 75%)",
                            lineHeight: 1.5,
                          }}
                        >
                          {q}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer note */}
              <div
                style={{
                  fontSize: "0.73rem",
                  color: "hsl(220, 8%, 40%)",
                  lineHeight: 1.55,
                  borderTop: "1px solid hsla(222, 25%, 14%, 0.8)",
                  paddingTop: "0.75rem",
                }}
              >
                Bring these questions to your school office, counselor, or caseworker.
                The AI has prepared them — a human expert will have the answers.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}