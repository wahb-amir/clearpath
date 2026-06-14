"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function LoginPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl"
    >
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-slate-100 mb-2">Welcome back</h1>
        <p className="text-slate-400 text-sm">Sign in to your ClearPath account</p>
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-300">Email</label>
          <input
            type="email"
            placeholder="name@example.com"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
          />
        </div>
        
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300">Password</label>
            <a href="#" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Forgot password?</a>
          </div>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
          />
        </div>

        <div className="flex items-center gap-2 py-2">
          <input type="checkbox" id="remember" className="rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900" />
          <label htmlFor="remember" className="text-sm text-slate-400">Remember me for 30 days</label>
        </div>

        <Link href="/app" className="block w-full">
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors mt-2">
            Sign In
          </button>
        </Link>
      </form>

      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 h-px bg-slate-800"></div>
        <span className="text-sm text-slate-500">or continue with</span>
        <div className="flex-1 h-px bg-slate-800"></div>
      </div>

      <button className="w-full bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:text-slate-100 text-slate-300 font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-3">
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google
      </button>

      <p className="mt-8 text-center text-sm text-slate-400">
        Don't have an account?{" "}
        <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
          Sign up
        </Link>
      </p>
    </motion.div>
  );
}
