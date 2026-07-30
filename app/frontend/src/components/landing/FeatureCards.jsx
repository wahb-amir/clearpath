"use client";
import { motion } from "framer-motion";
import {
  FileText,
  Clock,
  ListChecks,
  MessageCircle,
  ShieldCheck,
  Link2,
  Zap,
  Brain,
  Eye,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Plain-Language Summary",
    description:
      "Complex legal and bureaucratic language is instantly translated into simple, clear English anyone can understand.",
    color: "hsl(191, 100%, 50%)",
    bg: "hsla(221, 83%, 53%, 0.08)",
    border: "hsla(221, 83%, 53%, 0.15)",
  },
  {
    icon: Clock,
    title: "Deadline Extraction",
    description:
      "Never miss a critical date. ClearPath identifies every deadline in your document and color-codes by urgency.",
    color: "hsl(38, 92%, 58%)",
    bg: "hsla(38, 92%, 50%, 0.08)",
    border: "hsla(38, 92%, 50%, 0.15)",
  },
  {
    icon: ListChecks,
    title: "Actionable Checklist",
    description:
      "Every required action is extracted and turned into a numbered, interactive checklist so nothing slips through the cracks.",
    color: "hsl(142, 71%, 55%)",
    bg: "hsla(142, 71%, 45%, 0.08)",
    border: "hsla(142, 71%, 45%, 0.15)",
  },
  {
    icon: MessageCircle,
    title: "Questions to Ask",
    description:
      "AI-generated follow-up questions you can bring to a school counselor, housing officer, or support worker.",
    color: "hsl(199, 89%, 60%)",
    bg: "hsla(199, 89%, 48%, 0.08)",
    border: "hsla(199, 89%, 48%, 0.15)",
  },
  {
    icon: ShieldCheck,
    title: "Confidence Flags",
    description:
      "Every extracted item is rated for AI confidence. Low-confidence items are flagged for human verification.",
    color: "hsl(191, 70%, 72%)",
    bg: "hsla(221, 83%, 53%, 0.08)",
    border: "hsla(221, 83%, 53%, 0.15)",
  },
  {
    icon: Link2,
    title: "Trusted Source Links",
    description:
      "Relevant official resources, policy guides, and support directories are surfaced alongside the analysis.",
    color: "hsl(160, 60%, 55%)",
    bg: "hsla(160, 60%, 45%, 0.08)",
    border: "hsla(160, 60%, 45%, 0.15)",
  },
];

export default function FeatureCards() {
  return (
    <section style={{ padding: "5rem 1.5rem", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: "-5%",
          width: "35%",
          height: "50%",
          background:
            "radial-gradient(ellipse at center, hsla(221, 83%, 53%,0.06) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: "center", marginBottom: "3.5rem" }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.35rem 0.875rem",
              borderRadius: "999px",
              background: "hsla(221, 83%, 53%, 0.08)",
              border: "1px solid hsla(221, 83%, 53%, 0.2)",
              marginBottom: "1.25rem",
              color: "hsl(191, 70%, 78%)",
              fontSize: "0.78rem",
              fontWeight: 600,
            }}
          >
            <Brain size={12} />
            Everything you need, extracted automatically
          </div>
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
            Six powerful outputs,{" "}
            <span
              style={{
                background:
                  "linear-gradient(135deg, hsl(191, 70%, 72%) 0%, hsl(191, 100%, 50%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              one clear dashboard
            </span>
          </h2>
          <p
            style={{
              color: "hsl(220, 8%, 55%)",
              fontSize: "1rem",
              maxWidth: "500px",
              margin: "0 auto",
              lineHeight: 1.7,
            }}
          >
            Designed specifically for the types of documents families and
            students actually receive.
          </p>
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.07,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{
                  y: -5,
                  borderColor: feature.border.replace("0.15", "0.45"),
                }}
                style={{
                  padding: "1.5rem",
                  borderRadius: "16px",
                  background: "hsla(222, 35%, 10%, 0.8)",
                  border: `1px solid ${feature.border}`,
                  transition: "all 0.3s ease",
                  cursor: "default",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: feature.bg,
                    border: `1px solid ${feature.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1.125rem",
                  }}
                >
                  <Icon size={20} color={feature.color} />
                </div>
                <h3
                  style={{
                    color: "hsl(220, 20%, 90%)",
                    fontFamily: "Outfit, sans-serif",
                    fontWeight: 700,
                    fontSize: "1rem",
                    marginBottom: "0.5rem",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    color: "hsl(220, 8%, 52%)",
                    fontSize: "0.85rem",
                    lineHeight: 1.7,
                  }}
                >
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
