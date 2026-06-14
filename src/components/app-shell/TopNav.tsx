"use client";

import { Bell, Search, Menu } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface TopNavProps {
  onMenuClick: () => void;
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  return (
    <header className="h-[72px] bg-slate-950/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Menu size={24} />
        </button>
        <div className="hidden md:flex items-center text-sm text-slate-400">
          <span>Overview</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search documents..."
            className="w-64 bg-slate-900 border border-slate-800 rounded-full py-1.5 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500"
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 border-2 border-slate-950"></span>
        </motion.button>

        <Link href="/profile">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-8 h-8 rounded-full bg-blue-900 text-blue-200 flex items-center justify-center font-semibold text-sm border border-blue-800 cursor-pointer"
          >
            WA
          </motion.div>
        </Link>
      </div>
    </header>
  );
}
