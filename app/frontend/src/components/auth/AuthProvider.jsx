"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/auth/apiFetch";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * AuthProvider — wraps protected pages.
 * On mount it hits GET /auth/verify (which requires a valid accessToken cookie).
 * If the backend returns 401 (even after the automatic refresh-retry in apiFetch)
 * the user is redirected to /login.
 */
export default function AuthProvider({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState("loading"); // "loading" | "authenticated" | "unauthenticated"
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await apiFetch("/auth/verify");

        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          setUser({ userId: data.userId, sid: data.sid });
          setStatus("authenticated");
        } else {
          setStatus("unauthenticated");
          router.replace("/login");
        }
      } catch {
        if (!cancelled) {
          setStatus("unauthenticated");
          router.replace("/login");
        }
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "loading") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "hsl(222, 47%, 5%)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid hsl(222, 47%, 15%)",
            borderTopColor: "hsl(217, 91%, 60%)",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (status === "unauthenticated") {
    // Router.replace is already called; render nothing while navigating
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, status }}>
      {children}
    </AuthContext.Provider>
  );
}
