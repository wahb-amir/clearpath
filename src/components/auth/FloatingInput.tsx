"use client";

import * as React from "react";

type FloatingInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  rightSlot?: React.ReactNode;
};

export const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, error, className = "", rightSlot, id, ...props }, ref) => {
    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          placeholder=" "
          aria-invalid={!!error}
          className={[
            "peer h-14 w-full rounded-2xl border bg-[#070B13]/70 px-4 pt-5 text-sm text-[#F0F3F8]",
            "border-white/10 outline-none transition-all duration-200",
            "placeholder-transparent",
            "focus:border-[#00D4FF]/60 focus:ring-2 focus:ring-[#00D4FF]/10",
            error ? "border-red-400/60 focus:border-red-400/70 focus:ring-red-400/10" : "",
            rightSlot ? "pr-12" : "",
            className,
          ].join(" ")}
          {...props}
        />
        <label
          htmlFor={id}
          className={[
            "pointer-events-none absolute left-4 text-[#9399A6] transition-all duration-200",
            "top-3 translate-y-0 text-xs",
            "peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm",
            "peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-[#00D4FF]",
          ].join(" ")}
        >
          {label}
        </label>

        {rightSlot ? (
          <div className="absolute inset-y-0 right-3 flex items-center">{rightSlot}</div>
        ) : null}

        {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      </div>
    );
  }
);

FloatingInput.displayName = "FloatingInput";