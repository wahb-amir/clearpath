"use client";

import { motion } from "framer-motion";
import {
  Link2,
  ExternalLink,
  BookOpen,
  LifeBuoy,
  BadgeCheck,
} from "lucide-react";

const typeConfig = {
  official: {
    icon: BadgeCheck,
    label: "Official",
    color: "hsl(191, 100%, 50%)",
    bg: "hsla(221, 83%, 53%, 0.08)",
    border: "hsla(221, 83%, 53%, 0.15)",
  },
  support: {
    icon: LifeBuoy,
    label: "Support",
    color: "hsl(142, 71%, 55%)",
    bg: "hsla(142, 71%, 45%, 0.08)",
    border: "hsla(142, 71%, 45%, 0.15)",
  },
  guide: {
    icon: BookOpen,
    label: "Guide",
    color: "hsl(199, 89%, 55%)",
    bg: "hsla(199, 89%, 48%, 0.08)",
    border: "hsla(199, 89%, 48%, 0.15)",
  },
};

export default function SourcesCard({ result }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: 0.24,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{
        background: "hsla(222, 35%, 10%, 0.85)",
        border: "1px solid hsla(222, 25%, 16%, 0.8)",
        borderRadius: "16px",
        padding: "1.5rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          marginBottom: "1.125rem",
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
          <Link2 size={16} color="hsl(199, 89%, 55%)" />
        </div>

        <div>
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
            Trusted Sources
          </div>

          <div
            style={{
              color: "hsl(220, 20%, 90%)",
              fontWeight: 700,
              fontFamily: "Outfit, sans-serif",
              fontSize: "1rem",
            }}
          >
            Verify With Official Links
          </div>
        </div>
      </div>

      {/* Sources */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}
      >
        {result?.sources?.map((source, i) => {
          const tc = typeConfig[source?.type || "official"];
          const Icon = tc.icon;

          return (
            <motion.a
              key={i}
              href={source?.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{
                x: 4,
                borderColor: tc.border.replace("0.15", "0.4"),
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.875rem",
                padding: "0.875rem 1rem",
                borderRadius: "10px",
                background: tc.bg,
                border: `1px solid ${tc.border}`,
                textDecoration: "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: `${tc.color}18`,
                  border: `1px solid ${tc.color}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={15} color={tc.color} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: "hsl(220, 12%, 82%)",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "0.2rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {source?.title}
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    background: `${tc.color}15`,
                    padding: "0.1rem 0.4rem",
                    borderRadius: "4px",
                  }}
                >
                  <span
                    style={{
                      color: tc.color,
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    {tc.label}
                  </span>
                </div>
              </div>

              <ExternalLink
                size={14}
                color="hsl(220, 10%, 40%)"
                style={{ flexShrink: 0 }}
              />
            </motion.a>
          );
        })}
      </div>

      {/* Footer */}
      <p
        style={{
          color: "hsl(220, 8%, 40%)",
          fontSize: "0.75rem",
          marginTop: "1rem",
          lineHeight: 1.5,
        }}
      >
        Always verify information directly from official sources. These links
        are provided to help you find authoritative information.
      </p>
    </motion.div>
  );
}
