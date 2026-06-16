"use client";

import { motion } from "framer-motion";
import { MessageCircle, ChevronRight } from "lucide-react";

export default function QuestionsCard({ result }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "hsla(222, 35%, 10%, 0.85)",
        border: "1px solid hsla(222, 25%, 16%, 0.8)",
        borderRadius: "16px",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "hsla(199, 89%, 48%, 0.1)",
            border: "1px solid hsla(199, 89%, 48%, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MessageCircle size={16} color="hsl(199, 89%, 55%)" />
        </div>

        <div
          style={{
            color: "hsl(220, 10%, 55%)",
            fontSize: "0.72rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "0.15rem",
          }}
        >
          Questions to Ask
        </div>

        <div
          style={{
            color: "hsl(220, 20%, 90%)",
            fontWeight: 700,
            fontFamily: "Outfit, sans-serif",
            fontSize: "1rem",
          }}
        >
          Ask a Human Expert
        </div>
      </div>

      <p
        style={{
          color: "hsl(220, 8%, 50%)",
          fontSize: "0.8rem",
          marginBottom: "1rem",
          lineHeight: 1.6,
        }}
      >
        Bring these questions to your school office, counselor, or support worker:
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {result?.questions?.map((question, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{
              x: 4,
              backgroundColor: "hsla(199, 89%, 48%, 0.06)",
            }}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              borderRadius: "10px",
              background: "hsla(222, 40%, 7%, 0.5)",
              border: "1px solid hsla(222, 25%, 14%, 0.8)",
              cursor: "default",
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "6px",
                background: "hsla(199, 89%, 48%, 0.12)",
                border: "1px solid hsla(199, 89%, 48%, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: "1px",
                color: "hsl(199, 89%, 55%)",
                fontSize: "0.68rem",
                fontWeight: 700,
              }}
            >
              Q{i + 1}
            </div>

            <p
              style={{
                color: "hsl(220, 12%, 75%)",
                fontSize: "0.875rem",
                lineHeight: 1.55,
                margin: 0,
                flex: 1,
              }}
            >
              {question}
            </p>

            <ChevronRight
              size={14}
              color="hsl(220, 10%, 35%)"
              style={{ flexShrink: 0, marginTop: "3px" }}
            />
          </motion.div>
        ))}
      </div>

      <div
        style={{
          marginTop: "1rem",
          padding: "0.75rem 1rem",
          borderRadius: "10px",
          background: "hsla(199, 89%, 48%, 0.05)",
          border: "1px solid hsla(199, 89%, 48%, 0.12)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <MessageCircle size={12} color="hsl(199, 89%, 55%)" />
        <p
          style={{
            color: "hsl(199, 89%, 65%)",
            fontSize: "0.75rem",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          These questions are AI-suggested to help you get clarity from a human expert.
        </p>
      </div>
    </motion.div>
  );
}