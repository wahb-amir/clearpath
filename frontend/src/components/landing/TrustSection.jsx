"use client";

import { motion } from "framer-motion";
import {
  Shield,
  Eye,
  Users,
  AlertTriangle,
  CheckCircle,
  Heart,
} from "lucide-react";

const trustItems = [
  {
    icon: Shield,
    title: "AI Assists, Humans Decide",
    description:
      "ClearPath is a reading aid — not a legal or professional advisor. Every output is clearly labeled as AI-generated and includes a reminder to verify with official sources.",
    color: "hsl(191, 100%, 50%)",
    bg: "hsla(221, 83%, 53%, 0.08)",
    border: "hsla(221, 83%, 53%, 0.15)",
  },
  {
    icon: Eye,
    title: "Transparent Confidence Ratings",
    description:
      "We explicitly show how confident the AI is in each extracted item. Low-confidence extractions are flagged with warnings so you know when to double-check.",
    color: "hsl(191, 70%, 72%)",
    bg: "hsla(221, 83%, 53%, 0.08)",
    border: "hsla(221, 83%, 53%, 0.15)",
  },
  {
    icon: Users,
    title: "Designed for Real Families",
    description:
      "Built for parents, students, and caregivers who receive confusing government, school, and community documents — not for legal or financial professionals.",
    color: "hsl(142, 71%, 55%)",
    bg: "hsla(142, 71%, 45%, 0.08)",
    border: "hsla(142, 71%, 45%, 0.15)",
  },
  {
    icon: AlertTriangle,
    title: "No Documents Are Stored",
    description:
      "This prototype does not store, process, or transmit any uploaded documents. Everything happens locally in your browser session and is discarded when you leave.",
    color: "hsl(38, 92%, 58%)",
    bg: "hsla(38, 92%, 50%, 0.08)",
    border: "hsla(38, 92%, 50%, 0.15)",
  },
];

export default function TrustSection() {
  return (
    <section style={{ padding: "6rem 1.5rem", position: "relative" }}>
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        style={{ textAlign: "center", marginBottom: "3rem" }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.35rem 0.875rem",
            borderRadius: "999px",
            background: "hsla(142, 71%, 45%, 0.08)",
            border: "1px solid hsla(142, 71%, 45%, 0.2)",
            marginBottom: "1.25rem",
            color: "hsl(142, 71%, 60%)",
            fontSize: "0.78rem",
            fontWeight: 600,
          }}
        >
          <Heart size={12} />
          Responsible AI design
        </div>

        <h2
          style={{
            fontSize: "2.5rem",
            fontWeight: 800,
            color: "hsl(220, 20%, 93%)",
          }}
        >
          Built with{" "}
          <span
            style={{
              background:
                "linear-gradient(135deg, hsl(142, 71%, 60%), hsl(199, 89%, 60%))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            safety at the core
          </span>
        </h2>

        <p
          style={{
            color: "hsl(220, 8%, 55%)",
            maxWidth: 520,
            margin: "0 auto",
          }}
        >
          We believe AI should reduce stress — not create new risks.
        </p>
      </motion.div>

      {/* CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
        }}
      >
        {trustItems.map((item, i) => {
          const Icon = item.icon;

          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              style={{
                padding: "1.5rem",
                borderRadius: "16px",
                background: "hsla(222, 35%, 10%, 0.85)",
                border: `1px solid ${item.border}`,
              }}
            >
              <div style={{ display: "flex", gap: "1rem" }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: item.bg,
                    border: `1px solid ${item.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={18} color={item.color} />
                </div>

                <div>
                  <h3 style={{ color: "hsl(220, 20%, 90%)", fontWeight: 700 }}>
                    {item.title}
                  </h3>
                  <p
                    style={{ color: "hsl(220, 8%, 52%)", fontSize: "0.85rem" }}
                  >
                    {item.description}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        style={{
          marginTop: "3rem",
          padding: "2rem",
          borderRadius: "20px",
          textAlign: "center",
          background:
            "linear-gradient(135deg, hsla(221, 83%, 53%, 0.1), hsla(221, 83%, 53%, 0.05))",
          border: "1px solid hsla(221, 83%, 53%, 0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <CheckCircle size={20} color="hsl(142, 71%, 55%)" />
          <span
            style={{
              color: "hsl(220, 20%, 90%)",
              fontFamily: "Outfit, sans-serif",
              fontWeight: 700,
              fontSize: "1.25rem",
            }}
          >
            ClearPath does NOT replace professional advice
          </span>
        </div>
        <p
          style={{
            color: "hsl(220, 8%, 55%)",
            fontSize: "0.9rem",
            maxWidth: "600px",
            margin: "0 auto",
            lineHeight: 1.75,
          }}
        >
          Always consult with qualified professionals — school counselors, legal
          aid, social workers — for important decisions. ClearPath is a first
          step toward understanding, not a final answer.
        </p>
      </motion.div>
    </section>
  );
}
