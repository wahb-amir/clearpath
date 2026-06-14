"use client";
import { motion } from "framer-motion";
import { FlaskConical, Sparkles } from "lucide-react";

export default function DemoBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="demo-banner"
      style={{
        padding: "0.6rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.625rem",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <FlaskConical size={14} color="hsl(191, 100%, 50%)" />
        <span
          style={{
            color: "hsl(221, 89%, 80%)",
            fontSize: "0.8rem",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          PROTOTYPE DEMO
        </span>
        <span
          style={{
            color: "hsl(220, 8%, 50%)",
            fontSize: "0.8rem",
          }}
        >
          · Using mock data · No real AI calls · No documents stored
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          background: "hsla(221, 83%, 53%, 0.1)",
          border: "1px solid hsla(221, 83%, 53%, 0.2)",
          padding: "0.2rem 0.6rem",
          borderRadius: "999px",
        }}
      >
        <Sparkles size={10} color="hsl(191, 100%, 50%)" />
        <span style={{ color: "hsl(191, 100%, 50%)", fontSize: "0.72rem", fontWeight: 600 }}>
          USAII Hackathon 2024
        </span>
      </div>
    </motion.div>
  );
}
