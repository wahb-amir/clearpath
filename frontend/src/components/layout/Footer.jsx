"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Shield } from "lucide-react";

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
        {/* GRID */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "3rem",
            marginBottom: "3rem",
          }}
        >
          {/* BRAND */}
          <div>
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
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background:
                    "linear-gradient(135deg, hsl(221, 83%, 53%), hsl(221, 83%, 53%))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Zap size={16} color="white" />
              </div>

              <span
                style={{
                  fontWeight: 700,
                  fontSize: "1.06rem",
                  color: "hsl(220, 20%, 90%)",
                }}
              >
                ClearPath
              </span>
            </div>

            <p style={{ color: "hsl(220, 8%, 50%)", fontSize: "0.875rem" }}>
              Helping families understand documents with AI clarity.
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
              <span style={{ color: "hsl(142, 71%, 50%)", fontSize: "0.75rem" }}>
                Responsible AI Design
              </span>
            </div>
          </div>

          {/* PRODUCT */}
          <div>
            <h4
              style={{
                color: "hsl(220, 20%, 85%)",
                fontWeight: 600,
                fontSize: "0.875rem",
                marginBottom: "1rem",
                textTransform: "uppercase",
              }}
            >
              Product
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {[
                { label: "Try Demo", href: "/app" },
                { label: "How It Works", href: "/about" },
                { label: "Sample Documents", href: "/app#samples" },
              ].map((link) => (
                <Link key={link.href} href={link.href}>
                  <motion.span
                    whileHover={{ x: 4 }}
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

          {/* SAFETY */}
          <div>
            <h4
              style={{
                color: "hsl(220, 20%, 85%)",
                fontWeight: 600,
                fontSize: "0.875rem",
                marginBottom: "1rem",
                textTransform: "uppercase",
              }}
            >
              Safety & Trust
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {[
                { label: "Privacy Policy", href: "/about#privacy" },
                { label: "AI Limitations", href: "/about#limitations" },
                { label: "Human Review", href: "/about#human-review" },
              ].map((link) => (
                <Link key={link.href} href={link.href}>
                  <motion.span
                    whileHover={{ x: 4 }}
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
        </div>

        {/* BOTTOM BAR */}
        <div
          style={{
            borderTop: "1px solid hsla(222, 25%, 14%, 0.8)",
            paddingTop: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <p style={{ color: "hsl(220, 8%, 40%)", fontSize: "0.8rem" }}>
            © {year} ClearPath. Hackathon prototype.
          </p>

          <p style={{ color: "hsl(220, 8%, 40%)", fontSize: "0.8rem" }}>
            AI may be wrong — always verify.
          </p>
        </div>
      </div>
    </footer>
  );
}