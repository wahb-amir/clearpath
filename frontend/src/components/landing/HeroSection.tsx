"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Users, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import { useIsMobile } from "@/lib/useIsMobile";

const FloatingDocument = dynamic(() => import("@/components/3d/FloatingDocument"), { ssr: false });

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
      {/* Animated mesh gradient background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, hsla(222, 47%, 15%, 0.35) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 60%, hsla(222, 47%, 15%, 0.25) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 20% 70%, hsla(199, 89%, 20%, 0.2) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      />

      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(hsla(221, 83%, 53%,0.04) 1px, transparent 1px), linear-gradient(90deg, hsla(221, 83%, 53%,0.04) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          pointerEvents: "none",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 0%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 0%, black 40%, transparent 100%)",
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
        {/* Left: Copy */}
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
              style={{ width: "6px", height: "6px", borderRadius: "50%", background: "hsl(221, 83%, 53%)" }}
            />
            <span style={{ color: "hsl(191, 100%, 80%)", fontSize: "0.78rem", fontWeight: 600 }}>
              AI-Powered Document Clarity 
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
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
                background: "linear-gradient(135deg, hsl(191, 100%, 50%) 0%, hsl(191, 100%, 50%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Confusion
            </span>
            <br />
            Into{" "}
            <span
              style={{
                background: "linear-gradient(135deg, hsl(142, 71%, 60%) 0%, hsl(199, 89%, 60%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
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
            Upload any confusing school notice, legal letter, or community form. ClearPath instantly extracts{" "}
            <strong style={{ color: "hsl(220, 10%, 78%)" }}>plain-language summaries</strong>,{" "}
            <strong style={{ color: "hsl(220, 10%, 78%)" }}>deadlines</strong>, and{" "}
            <strong style={{ color: "hsl(220, 10%, 78%)" }}>action plans</strong> — so you always know what to do next.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap", marginBottom: "2.5rem" }}
          >
            <Link href="/app" style={{ textDecoration: "none" }}>
              <motion.button
                whileHover={{ scale: 1.04, boxShadow: "0 12px 40px hsla(221, 83%, 53%, 0.4)" }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.875rem 1.75rem",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(221, 83%, 53%) 100%)",
                  border: "none",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  boxShadow: "0 4px 20px hsla(221, 83%, 53%, 0.25)",
                }}
              >
                Try Free Demo
                <ArrowRight size={16} />
              </motion.button>
            </Link>

            <Link href="/about" style={{ textDecoration: "none" }}>
              <motion.button
                whileHover={{ scale: 1.02, borderColor: "hsla(221, 83%, 53%, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.875rem 1.75rem",
                  borderRadius: "12px",
                  background: "hsla(222, 35%, 12%, 0.8)",
                  border: "1px solid hsla(222, 25%, 20%, 0.8)",
                  color: "hsl(220, 10%, 70%)",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  transition: "border-color 0.2s ease",
                }}
              >
                How It Works
              </motion.button>
            </Link>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}
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

        {/* Right: 3D visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "relative",
            height: isMobile ? "320px" : "540px",
            display: isMobile ? "none" : "block",
          }}
        >
          {/* Glow behind 3D */}
          <div
            style={{
              position: "absolute",
              inset: "10%",
              background: "radial-gradient(ellipse at center, hsla(221, 83%, 53%, 0.15) 0%, transparent 70%)",
              filter: "blur(40px)",
              pointerEvents: "none",
            }}
          />
          <FloatingDocument />

          {/* Floating stat cards */}
          {[
            { label: "Documents Clarified", value: "12,400+", color: "hsl(191, 100%, 50%)", top: "12%", left: "-5%" },
            { label: "Avg. Clarity Score", value: "94%", color: "hsl(142, 71%, 55%)", bottom: "18%", right: "-5%" },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              style={{
                position: "absolute",
                top: stat.top,
                bottom: stat.bottom,
                left: stat.left,
                right: stat.right,
                background: "hsla(222, 40%, 8%, 0.9)",
                border: "1px solid hsla(222, 25%, 18%, 0.8)",
                borderRadius: "12px",
                padding: "0.75rem 1rem",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                zIndex: 2,
                minWidth: "140px",
              }}
            >
              <div style={{ color: stat.color, fontSize: "1.375rem", fontWeight: 800, fontFamily: "Outfit, sans-serif", letterSpacing: "-0.02em" }}>
                {stat.value}
              </div>
              <div style={{ color: "hsl(220, 8%, 50%)", fontSize: "0.72rem", marginTop: "0.1rem" }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Mobile: show a simple animated placeholder instead of 3D */}
        {isMobile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{
              height: "200px",
              borderRadius: "20px",
              background: "hsla(222, 35%, 10%, 0.8)",
              border: "1px solid hsla(221, 83%, 53%, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(ellipse at center, hsla(221, 83%, 53%, 0.12) 0%, transparent 70%)",
              }}
            />
            <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
              <motion.div
                animate={{ y: [0, -10, 0], rotate: [0, 2, -2, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                style={{ fontSize: "4rem", marginBottom: "0.5rem" }}
              >
                📄
              </motion.div>
              <p style={{ color: "hsl(191, 100%, 50%)", fontSize: "0.8rem", fontWeight: 600 }}>
                Upload any document →
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom fade */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "200px",
          background: "linear-gradient(to bottom, transparent, hsl(222, 47%, 5%))",
          pointerEvents: "none",
        }}
      />
    </section>
  );
}
