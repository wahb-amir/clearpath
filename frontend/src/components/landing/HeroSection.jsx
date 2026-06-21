"use client";

import { motion } from "framer-motion";
import { Shield, Users, Zap } from "lucide-react";
import CtaButton from "@/components/landing/CtaButton";
import dynamic from "next/dynamic";
import { useIsMobile } from "@/lib/useIsMobile";

const FloatingDocument = dynamic(
  () => import("@/components/3d/FloatingDocument"),
  { ssr: false },
);

const trustBadges = [
  { icon: Shield, label: "Human-reviewed output" },
  { icon: Zap, label: "Instant AI clarity" },
  { icon: Users, label: "Designed for families" },
];

export default function HeroSection() {
  const isMobile = useIsMobile();

  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
        paddingTop: "80px",
      }}
    >
      {/* Backgrounds */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, hsla(222, 47%, 15%, 0.35) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 60%, hsla(222, 47%, 15%, 0.25) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 20% 70%, hsla(199, 89%, 20%, 0.2) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "4rem 1.5rem",
          width: "100%",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: "3rem",
          alignItems: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* LEFT SIDE */}
        <div>
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.35rem 0.875rem",
              borderRadius: "999px",
              background: "hsla(221, 83%, 53%, 0.1)",
              border: "1px solid hsla(221, 83%, 53%, 0.25)",
              marginBottom: "1.5rem",
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "hsl(221, 83%, 53%)",
              }}
            />
            <span
              style={{
                color: "hsl(191, 100%, 80%)",
                fontSize: "0.78rem",
                fontWeight: 600,
              }}
            >
              AI-Powered Document Clarity
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.1,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              fontFamily: "Outfit, sans-serif",
              fontSize: isMobile ? "2.5rem" : "3.75rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.08,
              marginBottom: "1.5rem",
              color: "hsl(220, 20%, 95%)",
            }}
          >
            Turn{" "}
            <span
              style={{
                background:
                  "linear-gradient(135deg, hsl(191, 100%, 50%) 0%, hsl(191, 100%, 50%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Confusion
            </span>
            <br />
            Into{" "}
            <span
              style={{
                background:
                  "linear-gradient(135deg, hsl(142, 71%, 60%) 0%, hsl(199, 89%, 60%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Clarity
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{
              color: "hsl(220, 10%, 62%)",
              fontSize: isMobile ? "1rem" : "1.125rem",
              lineHeight: 1.75,
              marginBottom: "2rem",
              maxWidth: "480px",
            }}
          >
            Upload confusing documents and get instant clarity.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              display: "flex",
              gap: "0.875rem",
              flexWrap: "wrap",
              marginBottom: "2.5rem",
            }}
          >
            <motion.div style={{ marginTop: "4rem", textAlign: "center" }}>
              <div className="flex justify-center items-center">
                <CtaButton />
              </div>
            </motion.div>
          </motion.div>

          {/* TRUST BADGES FIXED */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              display: "flex",
              gap: "1.25rem",
              flexWrap: "wrap",
            }}
          >
            {trustBadges.map(({ icon: Icon, label }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  color: "hsl(220, 8%, 50%)",
                  fontSize: "0.78rem",
                }}
              >
                <Icon size={13} color="hsl(221, 83%, 53%)" />
                <span>{label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT SIDE */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          style={{
            position: "relative",
            height: isMobile ? "320px" : "540px",
            display: isMobile ? "none" : "block",
          }}
        >
          <FloatingDocument />
        </motion.div>
      </div>
    </section>
  );
}
