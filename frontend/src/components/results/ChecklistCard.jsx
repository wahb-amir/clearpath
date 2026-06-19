"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, ListChecks } from "lucide-react";

export default function ChecklistCard({ result }) {
  const [checked, setChecked] = useState(new Set());

  const actions = result?.actions || [];

  const toggle = (i) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const progress =
    actions.length > 0 ? (checked.size / actions.length) * 100 : 0;

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
          {checked.size}/{actions.length}
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
          const isChecked = checked.has(i);

          return (
            <motion.button
              key={i}
              onClick={() => toggle(i)}
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
              }}
            >
              {isChecked ? (
                <CheckCircle2 size={18} color="hsl(142,71%,50%)" />
              ) : (
                <Circle size={18} color="hsl(220,10%,40%)" />
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "hsl(191,100%,50%)",
                  }}
                >
                  {i + 1}
                </span>

                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: isChecked ? "hsl(220,10%,50%)" : "hsl(220,12%,78%)",
                    textDecoration: isChecked ? "line-through" : "none",
                  }}
                >
                  {action}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
