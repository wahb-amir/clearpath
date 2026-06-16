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
      if (!API_BASE_URL) {
        throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
      }

      if (data.password !== data.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          password: data.password,
        }),
        credentials: "include",
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Registration failed");
      }

      // ⚠️ Better approach: always use localStorage for auth tokens
      const storage = window.localStorage;

      storage.setItem("accessToken", payload.accessToken);
      storage.setItem("refreshToken", payload.refreshToken);
      storage.setItem("sid", payload.sid);

      router.push("/app");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Something went wrong"
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[2rem] border border-slate-700/50 bg-slate-900/80 p-6 shadow-[0_24px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_38%),radial-gradient(circle_at_top_right,rgba(0,212,255,0.10),transparent_30%)]" />

      <div className="relative">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#00D4FF]/20 bg-[#00D4FF]/10 px-3 py-1 text-xs text-[#00D4FF]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Create secure account
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-[#F0F3F8]">
            Create an account
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#9399A6]">
            Join ClearPath to start making sense of your documents.
          </p>
        </div>

        {/* FORM */}
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <input
            placeholder="Full name"
            {...register("fullName", {
              required: "Full name is required",
              minLength: { value: 2, message: "Enter a valid name" },
            })}
          />
          {errors.fullName && <p>{errors.fullName.message}</p>}

          <input
            placeholder="Email"
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: /^\S+@\S+\.\S+$/,
                message: "Invalid email",
              },
            })}
          />
          {errors.email && <p>{errors.email.message}</p>}

          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "Min 8 characters" },
            })}
          />
          {errors.password && <p>{errors.password.message}</p>}

          <button type="button" onClick={() => setShowPassword((v) => !v)}>
            {showPassword ? "Hide" : "Show"}
          </button>

          <input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm Password"
            {...register("confirmPassword", {
              required: "Confirm your password",
              validate: (v) => v === password || "Passwords do not match",
            })}
          />
          {errors.confirmPassword && <p>{errors.confirmPassword.message}</p>}

          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
          >
            {showConfirmPassword ? "Hide" : "Show"}
          </button>

          {/* TERMS FIXED */}
          <label className="flex items-start gap-3 text-sm text-[#9399A6]">
            <input
              type="checkbox"
              {...register("terms", {
                required: "You must accept terms",
              })}
            />

            <span>
              I agree to the{" "}
              <a href="#" className="text-[#00D4FF]">
                Terms
              </a>{" "}
              and{" "}
              <a href="#" className="text-[#00D4FF]">
                Privacy Policy
              </a>
            </span>
          </label>

          {errors.terms && <p>{errors.terms.message}</p>}

          {submitError && <p className="text-red-400">{submitError}</p>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create account"}
            <ArrowRight />
          </button>
        </form>

        {/* LOGIN LINK */}
        <p className="mt-8 text-center text-sm text-[#9399A6]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#00D4FF]">
            Sign in
          </Link>
        </p>
      </div>
    </motion.div>
  );
}