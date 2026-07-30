import Link from "next/link";
import { ShieldCheck, Zap } from "lucide-react";

export default function AuthLayout({ children }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070B13] text-[#F0F3F8]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.22),transparent_35%),radial-gradient(circle_at_right,rgba(0,212,255,0.12),transparent_30%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:72px_72px]" />

      <main className="relative z-10 flex min-h-screen flex-col px-4 py-6 sm:px-6">
        {/* HEADER */}
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#0D111A]/90 shadow-[0_0_30px_rgba(37,99,235,0.18)] backdrop-blur-xl">
              <Zap className="h-5 w-5 text-[#00D4FF]" />
            </div>

            {/* FIXED WRAPPER */}
            <div className="flex flex-col">
              <div className="text-base font-semibold tracking-tight text-[#F0F3F8]">
                ClearPath
              </div>
              <div className="text-xs text-[#9399A6]">
                Premium AI document intelligence
              </div>
            </div>
          </Link>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-[#0D111A]/80 px-4 py-2 text-xs text-[#9399A6] backdrop-blur-xl md:flex">
            <ShieldCheck className="h-4 w-4 text-[#52D67A]" />
            Private · Verified · Secure
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-xl">{children}</div>
        </div>

        {/* FOOTER */}
        <div className="mx-auto pb-2 text-center text-sm text-[#9399A6]">
          AI-assisted · Human verified · Always private
        </div>
      </main>
    </div>
  );
}
