import { ReactNode } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-blue-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
      
      <Link href="/" className="flex items-center gap-2 mb-8 z-10">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
          <Zap size={22} className="text-white" />
        </div>
        <span className="font-display font-bold text-2xl text-slate-100 tracking-tight">
          ClearPath
        </span>
      </Link>
      
      <div className="w-full max-w-md z-10">
        {children}
      </div>
      
      <div className="mt-8 text-center text-sm text-slate-500 z-10">
        <p>AI-assisted · Human verified · Always private</p>
      </div>
    </div>
  );
}
