"use client";
import { motion } from "framer-motion";
import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

export default function UrgencyBadge({ level, size = "md", showIcon = true }) {
  const config = {
    high: {
      label: "Urgent",
      icon: AlertTriangle,
      color: "hsl(0, 84%, 65%)",
      bg: "hsla(0, 84%, 60%, 0.1)",
      border: "hsla(0, 84%, 60%, 0.25)",
    },
    medium: {
      label: "Moderate",
      icon: AlertCircle,
      color: "hsl(38, 92%, 55%)",
      bg: "hsla(38, 92%, 50%, 0.1)",
      border: "hsla(38, 92%, 50%, 0.25)",
    },
    low: {
      label: "Routine",
      icon: CheckCircle,
      color: "hsl(142, 71%, 50%)",
      bg: "hsla(142, 71%, 45%, 0.1)",
      border: "hsla(142, 71%, 45%, 0.25)",
    },
  };

  const sizeConfig = {
    sm: {
      padding: "0.2rem 0.55rem",
      fontSize: "0.7rem",
      gap: "0.3rem",
      iconSize: 10,
    },
    md: {
      padding: "0.3rem 0.75rem",
      fontSize: "0.78rem",
      gap: "0.375rem",
      iconSize: 12,
    },
    lg: {
      padding: "0.45rem 1rem",
      fontSize: "0.875rem",
      gap: "0.5rem",
      iconSize: 14,
    },
  };

  const c = config[level] || config.low;

  const s = sizeConfig[size] || sizeConfig.md;

  const Icon = c?.icon || CheckCircle;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        padding: s.padding,
        borderRadius: "999px",
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        fontSize: s.fontSize,
        fontWeight: 600,
        letterSpacing: "0.03em",
        userSelect: "none",
      }}
    >
      {showIcon && <Icon size={s.iconSize} />}
      <span style={{ textTransform: "uppercase" }}>{c.label}</span>
    </motion.div>
  );
}
