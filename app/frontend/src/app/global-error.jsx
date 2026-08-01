"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown in the root layout (error.jsx cannot, since it
 * renders inside the layout it's meant to protect). Must render its own
 * <html>/<body> since it replaces the entire root layout on failure.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "hsl(222, 47%, 5%)" }}>
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
            color: "hsl(210, 20%, 92%)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ maxWidth: 480, opacity: 0.75 }}>
            ClearPath hit an unexpected error. Please try again, and if it
            keeps happening, reach out to support.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.6rem 1.4rem",
              borderRadius: "0.5rem",
              border: "1px solid hsl(210, 20%, 30%)",
              background: "hsl(210, 20%, 14%)",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
