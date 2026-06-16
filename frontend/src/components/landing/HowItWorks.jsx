"use client";
import { motion } from "framer-motion";
import { Upload, Cpu, LayoutDashboard, CheckCircle, ArrowRight } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Upload,
    title: "Upload or Paste",
    description:
      "Drop in any document — a school notice, government letter, scholarship form, or housing notice. Upload as PDF, image, or just paste the text.",
    color: "hsl(191, 100%, 50%)",
    bg: "hsla(221, 83%, 53%, 0.08)",
    border: "hsla(221, 83%, 53%, 0.18)",
  },
  {
    step: "02",
    icon: Cpu,
    title: "AI Reads & Extracts",
    description:
      "Our AI reads the document and extracts the key information: deadlines, required actions, urgency level, and areas of uncertainty.",
    color: "hsl(191, 70%, 72%)",
    bg: "hsla(221, 83%, 53%, 0.08)",
    border: "hsla(221, 83%, 53%, 0.18)",
  },
  {
    step: "03",
    icon: LayoutDashboard,
    title: "See Your Clear Dashboard",
    description:
      "Instantly view a plain-language summary, action checklist, deadline calendar, and suggested questions to ask a human expert.",
    color: "hsl(199, 89%, 60%)",
    bg: "hsla(199, 89%, 48%, 0.08)",
    border: "hsla(199, 89%, 48%, 0.18)",
  },
  {
    step: "04",
    icon: CheckCircle,
    title: "Act With Confidence",
    description:
      "Know exactly what to do, when, and who to ask. Every uncertain item is flagged so you can verify with a human when needed.",
    color: "hsl(142, 71%, 55%)",
    bg: "hsla(142, 71%, 45%, 0.08)",
    border: "hsla(142, 71%, 45%, 0.18)",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      style={{
        padding: "7rem 1.5rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background accents */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "-10%",
          width: "40%",
          height: "60%",
          background: "radial-gradient(ellipse at center, hsla(221, 83%, 53%,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
          filter: "blur(60px)",
        }}
      />

      <div style={{ maxWidth: "1280px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: "center", marginBottom: "4rem" }}
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
              color: "hsl(191, 100%, 50%)",
              fontSize: "0.78rem",
              fontWeight: 600,
            }}
          >
            Simple 4-Step Process
          </div>
          <h2
            style={{
              fontFamily: "Outfit, sans-serif",
              fontSize: "clamp(2rem, 4vw, 2.75rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "hsl(220, 20%, 93%)",
              marginBottom: "1rem",
            }}
          >
            From{" "}
            <span
              style={{
                background: "linear-gradient(135deg, hsl(191, 100%, 50%) 0%, hsl(191, 70%, 72%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              overwhelmed
            </span>{" "}
            to action-ready
          </h2>
          <p
            style={{
              color: "hsl(220, 8%, 55%)",
              fontSize: "1.05rem",
              maxWidth: "520px",
              margin: "0 auto",
              lineHeight: 1.7,
            }}
          >
            No technical skills needed. ClearPath handles the complexity so you can focus on what matters.
          </p>
        </motion.div>

        {/* Steps grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4, boxShadow: `0 20px 60px ${step.bg}` }}
                style={{
                  padding: "1.75rem",
                  borderRadius: "18px",
                  background: "hsla(222, 35%, 10%, 0.85)",
                  border: `1px solid ${step.border}`,
                  cursor: "default",
                  transition: "all 0.3s ease",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Step number watermark */}
                <div
                  style={{
                    position: "absolute",
                    top: "-10px",
                    right: "16px",
                    fontSize: "5rem",
                    fontWeight: 900,
                    fontFamily: "Outfit, sans-serif",
                    color: `${step.color}10`,
                    lineHeight: 1,
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  {step.step}
                </div>

                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "14px",
                    background: step.bg,
                    border: `1px solid ${step.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1.25rem",
                  }}
                >
                  <Icon size={22} color={step.color} />
                </div>

                <div
                  style={{
                    display: "inline-block",
                    padding: "0.2rem 0.55rem",
                    borderRadius: "5px",
                    background: `${step.color}15`,
                    color: step.color,
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    marginBottom: "0.75rem",
                  }}
                >
                  STEP {step.step}
                </div>

                <h3
                  style={{
                    color: "hsl(220, 20%, 90%)",
                    fontFamily: "Outfit, sans-serif",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    marginBottom: "0.625rem",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {step.title}
                </h3>
                <p style={{ color: "hsl(220, 8%, 55%)", fontSize: "0.875rem", lineHeight: 1.7 }}>
                  {step.description}
                </p>

                {i < steps.length - 1 && (
                  <div
                    style={{
                      display: "none",
                      position: "absolute",
                      right: "-16px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      zIndex: 2,
                    }}
                    className="md:block"
                  >
                    <ArrowRight size={16} color="hsl(220, 8%, 30%)" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
