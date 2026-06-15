"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Shield, ExternalLink } from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        background: "hsl(222, 47%, 4%)",
        borderTop: "1px solid hsla(222, 25%, 14%, 0.8)",
        padding: "4rem 1.5rem 2rem",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "3rem",
            marginBottom: "3rem",
          }}
        >
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1rem" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "9px",
                  background: "linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(221, 83%, 53%) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Zap size={16} color="white" />
              </div>
              <span
                style={{
                  fontFamily: "Outfit, sans-serif",
                  fontWeight: 700,
                  fontSize: "1.0625rem",
                  background: "linear-gradient(135deg, hsl(220, 20%, 95%) 0%, hsl(220, 10%, 75%) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                ClearPath
              </span>
            </div>
            <p style={{ color: "hsl(220, 8%, 50%)", fontSize: "0.875rem", lineHeight: 1.7, maxWidth: "240px" }}>
              Helping families and students understand confusing documents with AI-assisted clarity.
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginTop: "1rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "8px",
                background: "hsla(142, 71%, 45%, 0.08)",
                border: "1px solid hsla(142, 71%, 45%, 0.15)",
                width: "fit-content",
              }}
            >
              <Shield size={14} color="hsl(142, 71%, 50%)" />
              <span style={{ color: "hsl(142, 71%, 50%)", fontSize: "0.75rem", fontWeight: 500 }}>
                Responsible AI Design
              </span>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 style={{ color: "hsl(220, 20%, 85%)", fontWeight: 600, fontSize: "0.875rem", marginBottom: "1rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Product
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {[
                { label: "Try Demo", href: "/app" },
                { label: "How It Works", href: "/about" },
                { label: "Sample Documents", href: "/app#samples" },
              ].map((link) => (
                <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
                  <motion.span
                    whileHover={{ x: 4, color: "hsl(191, 100%, 50%)" }}
                    style={{
                      display: "block",
                      color: "hsl(220, 8%, 50%)",
                      fontSize: "0.875rem",
                      cursor: "pointer",
                      transition: "color 0.2s ease",
                    }}
                  >
                    {link.label}
                  </motion.span>
                </Link>
              ))}
            </div>
          </div>

          {/* Safety */}
          <div>
            <h4 style={{ color: "hsl(220, 20%, 85%)", fontWeight: 600, fontSize: "0.875rem", marginBottom: "1rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Safety & Trust
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {[
                { label: "Privacy Policy", href: "/about#privacy" },
                { label: "AI Limitations", href: "/about#limitations" },
                { label: "Human Review", href: "/about#human-review" },
              ].map((link) => (
                <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
                  <motion.span
                    whileHover={{ x: 4, color: "hsl(191, 100%, 50%)" }}
                    style={{
                      display: "block",
                      color: "hsl(220, 8%, 50%)",
                      fontSize: "0.875rem",
                      cursor: "pointer",
                    }}
                  >
                    {link.label}
                  </motion.span>
                </Link>
              ))}
            </div>
          </div>

          {/* Hackathon */}
          <div>
            <h4 style={{ color: "hsl(220, 20%, 85%)", fontWeight: 600, fontSize: "0.875rem", marginBottom: "1rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Project
            </h4>
            <div
              style={{
                padding: "0.875rem",
                borderRadius: "10px",
                background: "hsla(221, 83%, 53%, 0.06)",
                border: "1px solid hsla(221, 83%, 53%, 0.12)",
              }}
            >
             
              <p style={{ color: "hsl(220, 8%, 50%)", fontSize: "0.8rem", lineHeight: 1.6 }}>
                Built for the AI for Social Good track. Prototype with mock data only.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: "1px solid hsla(222, 25%, 14%, 0.8)",
            paddingTop: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <p style={{ color: "hsl(220, 8%, 40%)", fontSize: "0.8rem" }}>
            © {year} ClearPath. Hackathon prototype — not for production use.
          </p>
          <p style={{ color: "hsl(220, 8%, 40%)", fontSize: "0.8rem" }}>
            AI summaries may contain errors. Always verify with official sources.
          </p>
        </div>
      </div>
    </footer>
  );
}
