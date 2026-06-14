"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Users, AlertTriangle, ArrowRight, BookOpen, Scale, Lock, Heart } from "lucide-react";

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
            ClearPath was built for the <strong>USAII 2024 Hackathon (AI for Social Good track)</strong>. Our mission is to bridge the &quot;clarity gap&quot; that exists between bureaucratic institutions and the families they serve.
          </p>
          <p>
            Every day, parents and students receive confusing notices about attendance, financial aid, housing, and legal obligations. When these documents are written in dense, legalistic language, they cause stress and lead to missed deadlines.
          </p>
          <p>
            We use generative AI to instantly translate these documents into <strong>plain language</strong>, extracting exactly what the user needs to know: <em>What does this mean? When is it due? What do I do next?</em>
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
        <>
          <ul style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <li><strong>We do not provide legal advice.</strong> ClearPath is a reading comprehension aid, not a lawyer.</li>
            <li><strong>We do not guarantee perfect accuracy.</strong> AI models can hallucinate or misunderstand nuance. Always verify critical dates with the issuing organization.</li>
            <li><strong>We do not submit forms for you.</strong> We provide the checklist; you must take the action.</li>
            <li><strong>We are not a substitute for human professionals.</strong> If you have a counselor, social worker, or legal aid representative, consult them first.</li>
          </ul>
        </>
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
            AI is a powerful tool, but it should not replace human judgment, especially in high-stakes civic situations. ClearPath is designed with a <strong>Human-in-the-Loop (HITL)</strong> philosophy:
          </p>
          <div style={{ padding: "1rem", background: "hsla(142, 71%, 45%, 0.08)", border: "1px solid hsla(142, 71%, 45%, 0.2)", borderRadius: "8px", marginTop: "1rem" }}>
            <strong>Confidence Scoring:</strong> Every extracted deadline and action item is assigned a confidence score. If the AI is unsure, the interface explicitly warns the user to verify the information manually.
          </div>
          <div style={{ padding: "1rem", background: "hsla(199, 89%, 48%, 0.08)", border: "1px solid hsla(199, 89%, 48%, 0.2)", borderRadius: "8px", marginTop: "0.5rem" }}>
            <strong>Suggested Questions:</strong> Instead of pretending to know all the answers, ClearPath generates specific questions for the user to ask a human expert (like a school counselor or housing officer).
          </div>
        </>
      ),
    },
    {
      id: "privacy",
      title: "Privacy & Data Security",
      icon: Lock,
      color: "hsl(221, 83%, 53%)",
      content: (
        <>
          <p>
            Because ClearPath handles sensitive documents (like school records and housing notices), privacy is our top priority.
          </p>
          <p>
            <strong>In this prototype version:</strong>
          </p>
          <ul style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <li>No user accounts are required.</li>
            <li>No uploaded documents are stored in any database.</li>
            <li>All mock processing happens locally in the browser session.</li>
            <li>We do not track, sell, or analyze your personal data.</li>
          </ul>
        </>
      ),
    },
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
          transition={{ duration: 0.5 }}
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
              fontFamily: "Outfit, sans-serif",
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "hsl(220, 20%, 95%)",
              marginBottom: "1rem",
            }}
          >
            About ClearPath
          </h1>
          <p style={{ color: "hsl(220, 8%, 55%)", fontSize: "1.1rem", lineHeight: 1.7, maxWidth: "600px", margin: "0 auto" }}>
            Learn how we use AI responsibly to help families navigate complex bureaucratic systems.
          </p>
        </motion.div>

        {/* Content sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {sections.map((section, i) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.id}
                id={section.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{
                  background: "hsla(222, 35%, 10%, 0.6)",
                  border: "1px solid hsla(222, 25%, 16%, 0.8)",
                  borderRadius: "16px",
                  padding: "2rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: `${section.color}15`,
                      border: `1px solid ${section.color}30`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={18} color={section.color} />
                  </div>
                  <h2 style={{ color: "hsl(220, 20%, 90%)", fontFamily: "Outfit, sans-serif", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
                    {section.title}
                  </h2>
                </div>
                <div
                  style={{
                    color: "hsl(220, 10%, 70%)",
                    fontSize: "0.95rem",
                    lineHeight: 1.75,
                  }}
                  className="about-content"
                >
                  {section.content}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{
            marginTop: "4rem",
            padding: "2.5rem",
            borderRadius: "20px",
            background: "linear-gradient(135deg, hsla(221, 83%, 53%, 0.1) 0%, hsla(221, 83%, 53%, 0.08) 100%)",
            border: "1px solid hsla(221, 83%, 53%, 0.2)",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "hsl(220, 20%, 90%)", fontFamily: "Outfit, sans-serif", fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            Ready to try the prototype?
          </h2>
          <p style={{ color: "hsl(220, 8%, 55%)", fontSize: "0.95rem", marginBottom: "1.5rem" }}>
            Test out our mock document analysis tool right in your browser.
          </p>
          <Link href="/app" style={{ textDecoration: "none" }}>
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: "0 12px 30px hsla(221, 83%, 53%, 0.3)" }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.875rem 1.75rem",
                borderRadius: "12px",
                background: "linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(221, 83%, 53%) 100%)",
                border: "none",
                color: "white",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Open ClearPath Dashboard
              <ArrowRight size={16} />
            </motion.button>
          </Link>
        </motion.div>

        {/* Local styling for the content divs */}
        <style>{`
          .about-content p {
            margin-bottom: 1rem;
          }
          .about-content p:last-child {
            margin-bottom: 0;
          }
          .about-content strong {
            color: hsl(220, 20%, 85%);
            font-weight: 600;
          }
          .about-content em {
            color: hsl(220, 10%, 80%);
            font-style: italic;
          }
        `}</style>
      </div>
    </div>
  );
}
