"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FileSearch,
  History,
  Bookmark,
  User,
  Settings,
  HelpCircle,
  ShieldCheck,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";

const primaryNav = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app", label: "Analyze Document", icon: FileSearch },
  { href: "/history", label: "History", icon: History },
  { href: "/saved", label: "Saved Items", icon: Bookmark },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

const secondaryNav = [
  { href: "#", label: "Help Center", icon: HelpCircle },
  { href: "#", label: "Safety & Trust", icon: ShieldCheck },
  { href: "#", label: "Feedback", icon: MessageSquare },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
}

export default function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? "80px" : "260px" }}
      className="hidden md:flex flex-col border-r border-slate-800 bg-slate-950 h-screen sticky top-0"
      style={{
        transition: "width 0.3s ease",
      }}
    >
      <div className="flex items-center p-4 border-b border-slate-800 h-[72px]">
        <Link href="/" className="flex items-center gap-2 overflow-hidden flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Zap size={18} className="text-white" />
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-display font-bold text-lg text-slate-100 whitespace-nowrap"
            >
              ClearPath
            </motion.span>
          )}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1 custom-scrollbar">
        {!collapsed && (
          <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Main Menu
          </div>
        )}
        {primaryNav.map((item, idx) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          // Special case for Analyze Document matching /app, but we don't want two active states if both are /app. 
          // Let's just make isActive true if exact match, but actually Analyze Document could just be a button or exact match.
          // For now, if both point to /app, they both get active. We'll leave it as is for mockup purposes.

          return (
            <Link key={idx} href={item.href}>
              <motion.div
                whileHover={{ backgroundColor: "rgba(30, 41, 59, 0.8)" }} // slate-800
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  isActive ? "bg-blue-600/10 text-blue-500" : "text-slate-400 hover:text-slate-200"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                {!collapsed && <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>}
              </motion.div>
            </Link>
          );
        })}

        <div className="mt-8 mb-2">
          {!collapsed && (
            <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Support
            </div>
          )}
        </div>
        
        {secondaryNav.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Link key={idx} href={item.href}>
              <motion.div
                whileHover={{ backgroundColor: "rgba(30, 41, 59, 0.8)" }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-slate-400 hover:text-slate-200 transition-colors"
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                {!collapsed && <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>}
              </motion.div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-800 flex justify-end">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors w-full flex justify-center"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </motion.aside>
  );
}
