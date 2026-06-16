"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";

export default function DemoPreview() {
  const mockCards = [
    { label: "Plain Summary", icon: "📋", color: "hsl(191, 100%, 50%)" },
    { label: "2 Deadlines Found", icon: "⏰", color: "hsl(38, 92%, 58%)", urgent: true },
    { label: "5 Action Items", icon: "✅", color: "hsl(142, 71%, 55%)" },
    { label: "3 Questions", icon: "💬", color: "hsl(199, 89%, 60%)" },
  ];

  return (
    <section style={{ padding: "6rem 1.5rem", position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, hsla(221, 83%, 53%,0.07) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: "1280px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: "center", marginBottom: "3rem" }}
        >
          <h2
            style={{
              fontFamily: "Outfit, sans-serif",
              fontSize: "clamp(1.875rem, 4vw, 2.625rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "hsl(220, 20%, 93%)",
              marginBottom: "1rem",
            }}
          >
            See it in action
          </h2>
          <p style={{ color: "hsl(220, 8%, 55%)", fontSize: "1rem", maxWidth: "440px", margin: "0 auto", lineHeight: 1.7 }}>
            Here&apos;s what a ClearPath analysis looks like for a school attendance warning.
          </p>
        </motion.div>

        {/* Mock UI preview */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            borderRadius: "24px",
            overflow: "hidden",
            border: "1px solid hsla(221, 83%, 53%, 0.2)",
            boxShadow: "0 40px 120px hsla(221, 83%, 53%, 0.1), 0 0 0 1px hsla(222, 25%, 16%, 0.5)",
          }}
        >
          {/* Browser chrome */}
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "hsl(222, 47%, 6%)",
              borderBottom: "1px solid hsla(222, 25%, 14%, 0.8)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.375rem" }}>
              {["hsl(0,80%,60%)", "hsl(38,92%,55%)", "hsl(142,71%,50%)"].map((c, i) => (
                <div key={i} style={{ width: "10px", height: "10px", borderRadius: "50%", background: c, opacity: 0.7 }} />
              ))}
            </div>
            <div
              style={{
                flex: 1,
                padding: "0.3rem 0.875rem",
                background: "hsla(222, 35%, 10%, 0.8)",
                borderRadius: "6px",
                color: "hsl(220, 8%, 45%)",
                fontSize: "0.72rem",
                border: "1px solid hsla(222, 25%, 14%, 0.6)",
              }}
            >
              clearpath.app/analyze
            </div>
          </div>

          {/* App content */}
          <div
            style={{
              background: "hsl(222, 40%, 7%)",
              padding: "1.5rem",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            {/* Left: document input preview */}
            <div
              style={{
                background: "hsla(222, 35%, 10%, 0.8)",
                border: "1px solid hsla(222, 25%, 16%, 0.8)",
                borderRadius: "14px",
                padding: "1.25rem",
              }}
            >
              <div style={{ color: "hsl(220, 10%, 55%)", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                Input Document
              </div>
              <div
                style={{
                  background: "hsla(222, 40%, 7%, 0.6)",
                  border: "1px solid hsla(222, 25%, 14%, 0.6)",
                  borderRadius: "10px",
                  padding: "0.875rem",
                  marginBottom: "0.875rem",
                }}
              >
                {["██████████ ██████████████", "████████████ ██████ ███", "██████ ████████████████ ██", "████████ ██████████████", "███ ██████████████ ████"].map((line, i) => (
                  <div
                    key={i}
                    style={{
                      height: "8px",
                      borderRadius: "4px",
                      background: `hsla(220, 10%, ${20 + i * 3}%, 0.5)`,
                      marginBottom: "0.5rem",
                      width: i === 2 ? "70%" : i === 4 ? "85%" : "100%",
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  padding: "0.6rem 1rem",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(221, 83%, 53%) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem",
                  color: "white",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                }}
              >
                <Sparkles size={13} />
                Analyzing...
              </div>
            </div>

            {/* Right: results preview */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {mockCards.map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "10px",
                    background: "hsla(222, 35%, 10%, 0.8)",
                    border: `1px solid ${card.urgent ? "hsla(38,92%,50%,0.25)" : "hsla(222, 25%, 16%, 0.6)"}`,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>{card.icon}</span>
                  <span style={{ color: card.color, fontSize: "0.78rem", fontWeight: 600 }}>
                    {card.label}
                  </span>
                  {i === 0 && (
                    <div
                      style={{
                        marginLeft: "auto",
                        width: "50%",
                        height: "4px",
                        borderRadius: "999px",
                        background: "linear-gradient(90deg, hsl(221, 83%, 53%), hsl(221, 83%, 53%))",
                      }}
                    />
                  )}
                </motion.div>
              ))}
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "10px",
                  background: "hsla(142, 71%, 45%, 0.07)",
                  border: "1px solid hsla(142, 71%, 45%, 0.18)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <CheckCircle2 size={14} color="hsl(142, 71%, 55%)" />
                <span style={{ color: "hsl(142, 71%, 60%)", fontSize: "0.75rem" }}>High confidence · Verify deadline with school</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* CTA below preview */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          style={{ textAlign: "center", marginTop: "2.5rem" }}
        >
          <Link href="/app" style={{ textDecoration: "none" }}>
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: "0 12px 40px hsla(221, 83%, 53%, 0.35)" }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "1rem 2rem",
                borderRadius: "12px",
                background: "linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(221, 83%, 53%) 100%)",
                border: "none",
                color: "white",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: "pointer",
                boxShadow: "0 4px 20px hsla(221, 83%, 53%, 0.2)",
              }}
            >
              Try It Yourself — Free
              <ArrowRight size={16} />
            </motion.button>
          </Link>
          <p style={{ color: "hsl(220, 8%, 40%)", fontSize: "0.78rem", marginTop: "0.75rem" }}>
            No sign up required · Mock data only · Works in your browser
          </p>
        </motion.div>
      </div>
    </section>
  );
}
