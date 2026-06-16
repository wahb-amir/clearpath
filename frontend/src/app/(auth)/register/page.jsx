"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";

const API_BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });

  const password = watch("password");

  const onSubmit = async (data) => {
    setSubmitError(null);
    try {
      if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
      if (data.password !== data.confirmPassword) throw new Error("Passwords do not match");

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: data.fullName, email: data.email, password: data.password }),
        credentials: "include",
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Registration failed");

      window.localStorage.setItem("accessToken", payload.accessToken);
      window.localStorage.setItem("refreshToken", payload.refreshToken);
      window.localStorage.setItem("sid", payload.sid);

      router.push("/app");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 font-sans"
      style={{
        backgroundColor: "#0a0d14",
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(37,99,235,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 110%, rgba(0,212,255,0.10) 0%, transparent 55%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 32px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.04)",
          backgroundColor: "#0d1117",
        }}
      >
        <div className="px-8 py-10 sm:px-10">
          <div className="mb-7">
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium mb-4"
              style={{
                border: "1px solid rgba(0,212,255,0.2)",
                background: "rgba(0,212,255,0.08)",
                color: "#00D4FF",
                letterSpacing: "0.01em",
              }}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Secure account creation
            </div>
            <h1
              className="text-[1.625rem] font-bold leading-tight mb-1.5"
              style={{ color: "#F0F3F8", letterSpacing: "-0.025em" }}
            >
              Create your account
            </h1>
            <p className="text-[13px] leading-relaxed" style={{ color: "#6b7280" }}>
              Join thousands making sense of their documents.
            </p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium" style={{ color: "#9399A6", letterSpacing: "0.01em" }}>
                Full name
              </label>
              <input
                className="w-full rounded-[10px] px-3.5 py-[11px] text-[14px] outline-none transition-all duration-150"
                style={{
                  border: errors.fullName ? "1px solid rgba(248,113,113,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  color: "#F0F3F8",
                  fontFamily: "inherit",
                }}
                placeholder="Jane Smith"
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(0,212,255,0.45)";
                  e.target.style.background = "rgba(0,212,255,0.04)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.08)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.fullName ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.08)";
                  e.target.style.background = "rgba(255,255,255,0.03)";
                  e.target.style.boxShadow = "none";
                }}
                {...register("fullName", {
                  required: "Full name is required",
                  minLength: { value: 2, message: "Enter a valid name" },
                })}
              />
              {errors.fullName && (
                <span className="text-[11px]" style={{ color: "#f87171", letterSpacing: "0.01em" }}>
                  {errors.fullName.message}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium" style={{ color: "#9399A6", letterSpacing: "0.01em" }}>
                Email address
              </label>
              <input
                type="email"
                className="w-full rounded-[10px] px-3.5 py-[11px] text-[14px] outline-none transition-all duration-150"
                style={{
                  border: errors.email ? "1px solid rgba(248,113,113,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  color: "#F0F3F8",
                  fontFamily: "inherit",
                }}
                placeholder="jane@company.com"
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(0,212,255,0.45)";
                  e.target.style.background = "rgba(0,212,255,0.04)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.08)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.email ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.08)";
                  e.target.style.background = "rgba(255,255,255,0.03)";
                  e.target.style.boxShadow = "none";
                }}
                {...register("email", {
                  required: "Email is required",
                  pattern: { value: /^\S+@\S+\.\S+$/, message: "Invalid email address" },
                })}
              />
              {errors.email && (
                <span className="text-[11px]" style={{ color: "#f87171", letterSpacing: "0.01em" }}>
                  {errors.email.message}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium" style={{ color: "#9399A6", letterSpacing: "0.01em" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-[10px] pl-3.5 pr-10 py-[11px] text-[14px] outline-none transition-all duration-150"
                  style={{
                    border: errors.password ? "1px solid rgba(248,113,113,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    color: "#F0F3F8",
                    fontFamily: "inherit",
                  }}
                  placeholder="Min. 8 characters"
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(0,212,255,0.45)";
                    e.target.style.background = "rgba(0,212,255,0.04)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.08)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.password ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.08)";
                    e.target.style.background = "rgba(255,255,255,0.03)";
                    e.target.style.boxShadow = "none";
                  }}
                  {...register("password", {
                    required: "Password is required",
                    minLength: { value: 8, message: "Min 8 characters" },
                  })}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center transition-colors duration-150"
                  style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#9399A6")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <span className="text-[11px]" style={{ color: "#f87171", letterSpacing: "0.01em" }}>
                  {errors.password.message}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium" style={{ color: "#9399A6", letterSpacing: "0.01em" }}>
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="w-full rounded-[10px] pl-3.5 pr-10 py-[11px] text-[14px] outline-none transition-all duration-150"
                  style={{
                    border: errors.confirmPassword ? "1px solid rgba(248,113,113,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    color: "#F0F3F8",
                    fontFamily: "inherit",
                  }}
                  placeholder="Repeat password"
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(0,212,255,0.45)";
                    e.target.style.background = "rgba(0,212,255,0.04)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.08)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.confirmPassword ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.08)";
                    e.target.style.background = "rgba(255,255,255,0.03)";
                    e.target.style.boxShadow = "none";
                  }}
                  {...register("confirmPassword", {
                    required: "Please confirm your password",
                    validate: (v) => v === password || "Passwords do not match",
                  })}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center transition-colors duration-150"
                  style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#9399A6")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="text-[11px]" style={{ color: "#f87171", letterSpacing: "0.01em" }}>
                  {errors.confirmPassword.message}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-[15px] h-[15px] rounded flex-shrink-0 cursor-pointer accent-[#00D4FF]"
                  {...register("terms", { required: "You must accept the terms to continue" })}
                />
                <span className="text-[12.5px] leading-snug" style={{ color: "#6b7280" }}>
                  I agree to the{" "}
                  <a href="#" className="transition-opacity hover:opacity-75" style={{ color: "#00D4FF", textDecoration: "none" }}>
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="transition-opacity hover:opacity-75" style={{ color: "#00D4FF", textDecoration: "none" }}>
                    Privacy Policy
                  </a>
                </span>
              </label>
              {errors.terms && (
                <span className="text-[11px]" style={{ color: "#f87171", letterSpacing: "0.01em" }}>
                  {errors.terms.message}
                </span>
              )}
            </div>

            {submitError && (
              <div
                className="text-[12.5px] rounded-lg px-3.5 py-2.5 leading-relaxed"
                style={{
                  color: "#f87171",
                  background: "rgba(248,113,113,0.07)",
                  border: "1px solid rgba(248,113,113,0.2)",
                }}
              >
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-[10px] py-3 text-[14px] font-semibold text-white transition-all duration-150 mt-1 disabled:opacity-55 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #00D4FF 0%, #2563eb 100%)",
                boxShadow: "0 4px 20px rgba(0,212,255,0.2)",
                letterSpacing: "0.01em",
                border: "none",
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.opacity = "0.92";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,212,255,0.28)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,212,255,0.2)";
              }}
            >
              {isSubmitting ? (
                <>
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px]" style={{ color: "#4b5563" }}>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium transition-opacity hover:opacity-75"
              style={{ color: "#00D4FF", textDecoration: "none" }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #3d4451; }
      `}</style>
    </div>
  );
}
