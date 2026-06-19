"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Users,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Scale,
  Lock,
  Heart,
} from "lucide-react";

export default function AboutPage() {
  const sections = [
    {
      id: "mission",
      title: "Our Mission",
      icon: Heart,
      color: "hsl(221, 83%, 53%)",
      content: (
        <>
          <p>
            Our mission is to bridge the "clarity gap" between
            bureaucratic institutions and the families they serve.
          </p>

          <p>
            Every day, parents and students receive confusing notices about
            attendance, financial aid, housing, and legal obligations. These
            documents often cause stress and missed deadlines.
          </p>

          <p>
            We use generative AI to translate documents into plain language and
            extract what matters: what it means, when it is due, and what to do
            next.
          </p>
        </>
      ),
    },

    {
      id: "limitations",
      title: "What ClearPath Does NOT Do",
      icon: AlertTriangle,
      color: "hsl(38, 92%, 55%)",
      content: (
        <ul
          style={{
            paddingLeft: "1.2rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <li>
            We do not provide legal advice. ClearPath is a reading aid, not a
            lawyer.
          </li>
          <li>
            We do not guarantee perfect accuracy. Always verify critical
            information.
          </li>
          <li>We do not submit forms for you. We only explain them.</li>
          <li>We are not a substitute for human professionals.</li>
        </ul>
      ),
    },

    {
      id: "human-review",
      title: "Human-in-the-Loop Design",
      icon: Users,
      color: "hsl(142, 71%, 50%)",
      content: (
        <>
          <p>
            AI is powerful, but it should not replace human judgment in
            high-stakes situations. ClearPath follows a Human-in-the-Loop (HITL)
            design.
          </p>

          <div
            style={{
              padding: "1rem",
              background: "hsla(142, 71%, 45%, 0.08)",
              border: "1px solid hsla(142, 71%, 45%, 0.2)",
              borderRadius: "8px",
              marginTop: "1rem",
            }}
          >
            <strong>Confidence Scoring:</strong> Each extracted item gets a
            confidence score. Low-confidence outputs trigger warnings.
          </div>

          <div
            style={{
              padding: "1rem",
              background: "hsla(199, 89%, 48%, 0.08)",
              border: "1px solid hsla(199, 89%, 48%, 0.2)",
              borderRadius: "8px",
              marginTop: "0.5rem",
            }}
          >
            <strong>Suggested Questions:</strong> The system suggests questions
            for human experts instead of guessing.
          </div>
        </>
      ),
    }
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "hsl(222, 47%, 5%)",
        paddingTop: "100px",
        paddingBottom: "4rem",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 1.5rem" }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: "3rem", textAlign: "center" }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.35rem 0.875rem",
              borderRadius: "999px",
              background: "hsla(221, 83%, 53%, 0.1)",
              border: "1px solid hsla(221, 83%, 53%, 0.2)",
              marginBottom: "1.25rem",
              color: "hsl(191, 100%, 50%)",
              fontSize: "0.78rem",
              fontWeight: 600,
            }}
          >
            <Scale size={12} />
            Safety, Trust & Ethics
          </div>

          <h1
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              color: "hsl(220, 20%, 95%)",
              marginBottom: "1rem",
            }}
          >
            About ClearPath
          </h1>

          <p style={{ color: "hsl(220, 8%, 55%)" }}>
            Learn how we responsibly use AI for public understanding.
          </p>
        </motion.div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {sections.map((section, i) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.id}
                style={{
                  background: "hsla(222, 35%, 10%, 0.6)",
                  border: "1px solid hsla(222, 25%, 16%, 0.8)",
                  borderRadius: "16px",
                  padding: "2rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    marginBottom: "1rem",
                  }}
                >
                  <Icon size={18} color={section.color} />
                  <h2 style={{ color: "white" }}>{section.title}</h2>
                </div>

                <div style={{ color: "hsl(220, 10%, 70%)", lineHeight: 1.7 }}>
                  {section.content}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div style={{ marginTop: "4rem", textAlign: "center" }}>
          <Link href="/app">
            <button
              style={{
                padding: "1rem 2rem",
                borderRadius: "12px",
                background: "hsl(221, 83%, 53%)",
                color: "white",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              Open Dashboard <ArrowRight size={16} />
            </button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
