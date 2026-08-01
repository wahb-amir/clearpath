"use client";

import { useEffect } from "react";

/**
 * App Router error boundary. Catches any uncaught error thrown while
 * rendering (or in an event handler wired through startTransition) inside
 * this route segment and below, and replaces the default dev/prod overlay
 * with a friendly, non-technical screen so raw stack traces never reach
 * end users.
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    // Log full detail server-side/console for developers; never render it.
    console.error("[app error boundary]", error);
  }, [error]);

  return (
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
        background: "hsl(222, 47%, 5%)",
        color: "hsl(210, 20%, 92%)",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
        Something went wrong
      </h1>
      <p style={{ maxWidth: 480, opacity: 0.75 }}>
        We hit an unexpected error processing your request. Nothing on your
        end is wrong — please try again, and if it keeps happening, reach out
        to support.
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
  );
}
