"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { FloatingInput } from "@/components/auth/FloatingInput";

const API_BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
      remember: true,
    },
  });

  const onSubmit = async (data) => {
    setSubmitError(null);

    try {
      if (!API_BASE_URL) {
        throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");
      }

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
        credentials: 'include'
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Invalid credentials");
      }

      const storage = data.remember ? window.localStorage : window.sessionStorage;

      storage.setItem("accessToken", payload.accessToken);
      storage.setItem("refreshToken", payload.refreshToken);
      storage.setItem("sid", payload.sid);

      router.push("/app");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      setSubmitError(message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[2rem] border border-slate-700/50 bg-slate-900/80 p-6 shadow-[0_24px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_38%),radial-gradient(circle_at_top_right,rgba(0,212,255,0.10),transparent_30%)]" />

      <div className="relative">
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#52D67A]/20 bg-[#52D67A]/10 px-3 py-1 text-xs text-[#52D67A]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure sign-in
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#F0F3F8]">
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#9399A6]">
            Sign in to your ClearPath account.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FloatingInput
            id="login-email"
            label="Email address"
            type="email"
            autoComplete="email"
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: /^\S+@\S+\.\S+$/,
                message: "Enter a valid email address",
              },
            })}
            error={errors.email?.message}
          />

          <FloatingInput
            id="login-password"
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-full p-1 text-[#9399A6] transition hover:text-[#F0F3F8]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            }
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "Password must be at least 8 characters" },
            })}
            error={errors.password?.message}
          />

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm text-[#9399A6]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/12 bg-[#070B13] text-[#00D4FF] focus:ring-[#00D4FF]"
                {...register("remember")}
              />
              Remember me for 30 days
            </label>

            <Link
              href="/forgot-password"
              className="text-sm text-[#00D4FF] transition hover:text-[#7deaff]"
            >
              Forgot password?
            </Link>
          </div>

          {submitError && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {submitError}
            </div>
          )}

          <motion.button
            type="submit"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.99 }}
            disabled={isSubmitting}
            className="group mt-2 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2563EB] via-[#1d4ed8] to-[#00D4FF] px-4 text-sm font-medium text-white shadow-[0_16px_45px_rgba(37,99,235,0.28)] transition disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
            {!isSubmitting && (
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            )}
          </motion.button>
        </form>

        <p className="mt-8 text-center text-sm text-[#9399A6]">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-[#00D4FF] transition hover:text-[#7deaff]"
          >
            Create one
          </Link>
        </p>
      </div>
    </motion.div>
  );
}