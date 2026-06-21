"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/auth/apiFetch";

/**
 * Smart CTA button for the landing page.
 * Silently checks /auth/verify on mount so the redirect is instant on click.
 * Authenticated  → /analyze
 * Unauthenticated → /login
 */
export default function CtaButton() {
  const router = useRouter();
  const [authed, setAuthed] = useState(null); // null = unknown, true/false after check

  useEffect(() => {
    let cancelled = false;
    apiFetch("/auth/verify", { retryOnUnauthorized: false })
      .then((res) => { if (!cancelled) setAuthed(res.ok); })
      .catch(() => { if (!cancelled) setAuthed(false); });
    return () => { cancelled = true; };
  }, []);

  function handleClick() {
    // authed may still be null if the network is very slow; default to /login in that case
    router.push(authed === true ? "/analyze" : "/login");
  }

  return (
    <button
      onClick={handleClick}
      className="flex gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-[10px]
        font-semibold duration-200 transition-all cursor-pointer"
    >
      {authed === true ? "Go to Dashboard" : "Try Free Demo"} <ArrowRight />
    </button>
  );
}
