"use client";

import { motion } from "framer-motion";
import { Clock, Calendar, AlertTriangle, CircleDot } from "lucide-react";
import UrgencyBadge from "@/components/ui/UrgencyBadge";

function getDaysLabel(days) {
  if (days === undefined || days === null) return null;
  if (days <= 0) return { text: "Past due", color: "text-red-400", bg: "bg-red-500/10" };
  if (days === 1) return { text: "Tomorrow", color: "text-red-400", bg: "bg-red-500/10" };
  if (days <= 3) return { text: `${days} days left`, color: "text-red-400", bg: "bg-red-500/10" };
  if (days <= 7) return { text: `${days} days left`, color: "text-amber-400", bg: "bg-amber-500/10" };
  return { text: `${days} days left`, color: "text-slate-400", bg: "bg-white/5" };
}

function getUrgencyStyles(level = "low") {
  const normalized = String(level).toLowerCase();

  switch (normalized) {
    case "high":
      return {
        card: "border-red-500/25 bg-red-500/5",
        bar: "from-red-500 to-orange-400",
        icon: "text-red-400",
        dot: "bg-red-400",
        label: "High priority",
      };
    case "medium":
      return {
        card: "border-amber-500/25 bg-amber-500/5",
        bar: "from-amber-500 to-yellow-400",
        icon: "text-amber-400",
        dot: "bg-amber-400",
        label: "Medium priority",
      };
    default:
      return {
        card: "border-slate-700/80 bg-slate-900/50",
        bar: "from-slate-500 to-slate-400",
        icon: "text-slate-500",
        dot: "bg-slate-500",
        label: "Low priority",
      };
  }
}

export default function DeadlinesCard({ result }) {
  const deadlines = result?.deadlines || [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-md"
    >
      {/* Header */}
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
          <Clock size={17} className="text-amber-400" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Key Deadlines
          </div>
          <div className="text-base font-semibold text-slate-100">
            Dates You Must Not Miss
          </div>
        </div>

        <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300">
          {deadlines.length} items
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {deadlines.map((deadline, i) => {
          const urgency = (deadline?.urgency || deadline?.priority || "low").toLowerCase();
          const urgencyStyle = getUrgencyStyles(urgency);
          const daysInfo = getDaysLabel(deadline?.text);

          const title = deadline?.supporting_evidence || "Untitled deadline";
          const meaning = deadline?.meaning || "No description provided";

          return (
            <motion.div
              key={deadline?.id || i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className={[
                "relative overflow-hidden rounded-xl border p-4",
                "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
                urgencyStyle.card,
              ].join(" ")}
            >
              {/* Accent bar */}
              <div
                className={[
                  "absolute left-0 top-0 h-full w-1 bg-gradient-to-b",
                  urgencyStyle.bar,
                ].join(" ")}
              />

              <div className="flex items-start gap-3 pl-2">
                {/* Left dot/icon */}
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/80">
                  {urgency === "high" ? (
                    <AlertTriangle size={15} className={urgencyStyle.icon} />
                  ) : (
                    <CircleDot size={15} className={urgencyStyle.icon} />
                  )}
                </div>

                {/* Main content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {title}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-500" />
                          <span className="truncate">{meaning}</span>
                        </span>

                        {daysInfo && (
                          <span
                            className={[
                              "rounded-full px-2.5 py-1 text-[0.72rem] font-semibold",
                              daysInfo.color,
                              daysInfo.bg,
                            ].join(" ")}
                          >
                            {daysInfo.text}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:shrink-0">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[0.72rem] font-medium text-slate-300">
                        <span className={`h-1.5 w-1.5 rounded-full ${urgencyStyle.dot}`} />
                        {urgencyStyle.label}
                      </span>

                      <UrgencyBadge
                        level={urgency}
                        size="sm"
                        showIcon={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}