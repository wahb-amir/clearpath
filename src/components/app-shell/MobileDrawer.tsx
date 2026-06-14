"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Zap } from "lucide-react";
import {
  LayoutDashboard,
  FileSearch,
  History,
  Bookmark,
  User,
  Settings,
} from "lucide-react";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const navLinks = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app", label: "Analyze", icon: FileSearch },
  { href: "/history", label: "History", icon: History },
  { href: "/saved", label: "Saved Items", icon: Bookmark },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 bottom-0 left-0 w-3/4 max-w-sm bg-slate-950 border-r border-slate-800 z-50 md:hidden flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Zap size={18} className="text-white" />
                </div>
                <span className="font-display font-bold text-lg text-slate-100">
                  ClearPath
                </span>
              </Link>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
              <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Menu
              </div>
              {navLinks.map((item, idx) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link key={idx} href={item.href} onClick={onClose}>
                    <div
                      className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                        isActive
                          ? "bg-blue-600/10 text-blue-500"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <Icon size={20} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
