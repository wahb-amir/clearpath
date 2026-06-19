"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Zap, Shield } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/app", label: "Try ClearPath" },
    { href: "/about", label: "How It Works" },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          background: scrolled
            ? "hsla(222, 47%, 5%, 0.95)"
            : "hsla(222, 47%, 5%, 0.0)",
          backdropFilter: scrolled ? "blur(24px)" : "none",
          borderBottom: scrolled
            ? "1px solid hsla(222, 25%, 16%, 0.6)"
            : "none",
          transition: "all 0.4s ease",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "1rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo */}
          <Link href="/" style={{ textDecoration: "none" }}>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  background:
                    "linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(221, 83%, 53%) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 20px hsla(221, 83%, 53%, 0.35)",
                }}
              >
                <Zap size={18} color="white" />
              </div>
              <span
                style={{
                  fontFamily: "Outfit, sans-serif",
                  fontWeight: 700,
                  fontSize: "1.125rem",
                  letterSpacing: "-0.02em",
                  background:
                    "linear-gradient(135deg, hsl(220, 20%, 95%) 0%, hsl(220, 10%, 75%) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                ClearPath
              </span>
            </motion.div>
          </Link>

          {/* Desktop Links */}
          <div
            className="hidden md:flex"
            style={{ alignItems: "center", gap: "0.25rem" }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ textDecoration: "none" }}
              >
                <motion.span
                  whileHover={{ color: "hsl(220, 20%, 95%)" }}
                  style={{
                    display: "block",
                    padding: "0.5rem 1rem",
                    borderRadius: "8px",
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    color: "hsl(220, 10%, 65%)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = "hsl(220, 20%, 95%)";
                    e.target.style.background = "hsla(222, 35%, 12%, 0.8)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = "hsl(220, 10%, 65%)";
                    e.target.style.background = "transparent";
                  }}
                >
                  {link.label}
                </motion.span>
              </Link>
            ))}
          </div>

          {/* CTA + Mobile toggle */}
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <Link
              href="/app"
              style={{ textDecoration: "none" }}
              className="hidden md:block"
            >
              <motion.button
                whileHover={{
                  scale: 1.03,
                  boxShadow: "0 8px 30px hsla(221, 83%, 53%, 0.35)",
                }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "10px",
                  background:
                    "linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(221, 83%, 53%) 100%)",
                  border: "none",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Try Free Demo
              </motion.button>
            </Link>

            {/* Mobile menu button */}
            <motion.button
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              whileTap={{ scale: 0.9 }}
              style={{
                background: "hsla(222, 35%, 12%, 0.8)",
                border: "1px solid hsla(222, 25%, 16%, 0.8)",
                borderRadius: "8px",
                padding: "0.5rem",
                color: "hsl(220, 20%, 85%)",
                cursor: "pointer",
                display: "flex",
              }}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{
              position: "fixed",
              top: "60px",
              left: 0,
              right: 0,
              zIndex: 49,
              background: "hsla(222, 47%, 5%, 0.98)",
              backdropFilter: "blur(24px)",
              borderBottom: "1px solid hsla(222, 25%, 16%, 0.6)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "1rem 1.5rem 1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "10px",
                        color: "hsl(220, 10%, 70%)",
                        fontWeight: 500,
                        fontSize: "1rem",
                        background: "hsla(222, 35%, 10%, 0.5)",
                        border: "1px solid hsla(222, 25%, 16%, 0.5)",
                      }}
                    >
                      {link.label}
                    </div>
                  </Link>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Link
                  href="/app"
                  onClick={() => setMobileOpen(false)}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      padding: "0.875rem 1rem",
                      borderRadius: "10px",
                      background:
                        "linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(221, 83%, 53%) 100%)",
                      color: "white",
                      fontWeight: 600,
                      fontSize: "1rem",
                      textAlign: "center",
                      marginTop: "0.25rem",
                    }}
                  >
                    Try Free Demo
                  </div>
                </Link>
              </motion.div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1rem",
                  color: "hsl(142, 71%, 50%)",
                  fontSize: "0.8rem",
                }}
              >
                <Shield size={14} />
                <span>AI-assisted · Human verified · Always private</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
