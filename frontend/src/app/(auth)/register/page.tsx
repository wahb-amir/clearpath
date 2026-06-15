"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { FloatingInput } from "@/components/auth/FloatingInput";

type RegisterFormValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
};

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });

  const password = watch("password");

  const onSubmit = async (_data: RegisterFormValues) => {
    router.push("/app");
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

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FloatingInput
            id="fullName"
            label="Full name"
            type="text"
            autoComplete="name"
            {...register("fullName", {
              required: "Full name is required",
              minLength: { value: 2, message: "Enter your full name" },
            })}
            error={errors.fullName?.message}
          />

          <FloatingInput
            id="register-email"
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
            id="register-password"
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-full p-1 text-[#9399A6] transition hover:text-[#F0F3F8]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "Password must be at least 8 characters" },
            })}
            error={errors.password?.message}
          />

          <FloatingInput
            id="confirmPassword"
            label="Confirm password"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            rightSlot={
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="rounded-full p-1 text-[#9399A6] transition hover:text-[#F0F3F8]"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
            {...register("confirmPassword", {
              required: "Please confirm your password",
              validate: (value) => value === password || "Passwords do not match",
            })}
            error={errors.confirmPassword?.message}
          />

          <label className="flex items-start gap-3 pt-1 text-sm leading-6 text-[#9399A6]">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-white/12 bg-[#070B13] text-[#00D4FF] focus:ring-[#00D4FF]"
              {...register("terms", {
                required: "You must accept the terms",
              })}
            />
            <span>
              I agree to the{" "}
              <a href="#" className="text-[#00D4FF] transition hover:text-[#7deaff]">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-[#00D4FF] transition hover:text-[#7deaff]">
                Privacy Policy
              </a>
              .
            </span>
          </label>

          {errors.terms?.message ? (
            <p className="text-xs text-red-300">{errors.terms.message}</p>
          ) : null}

          <motion.button
            type="submit"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.99 }}
            disabled={isSubmitting}
            className="group mt-2 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2563EB] via-[#1d4ed8] to-[#00D4FF] px-4 text-sm font-medium text-white shadow-[0_16px_45px_rgba(37,99,235,0.28)] transition disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Creating account..." : "Create account"}
            {!isSubmitting && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
          </motion.button>
        </form>

        <p className="mt-8 text-center text-sm text-[#9399A6]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[#00D4FF] transition hover:text-[#7deaff]">
            Sign in
          </Link>
        </p>
      </div>
    </motion.div>
  );
}