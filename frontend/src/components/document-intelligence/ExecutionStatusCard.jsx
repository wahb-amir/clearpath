"use client";

import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, Wifi, WifiOff } from "lucide-react";
import TimelineFeed from "./TimelineFeed";

export default function ExecutionStatusCard({
  message,
  badgeColors,
  statusMeta,
  progress,
  progressFillClass,
  stage,
  completed,
  failed,
  timeline,
  latestEventId,
  timelineEndRef,
  analysisRequestId,
  workerId,
  error,
}) {
  return (
    <div className="mt-6 p-5 sm:p-6 rounded-[20px] border border-[#2B303B] bg-[#0B0D10]">
      <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center mb-4">
        <div>
          <div className="font-semibold text-sm text-white">Execution Status</div>
          <div className="text-xs sm:text-sm text-gray-400 mt-1">{message}</div>
        </div>

        <span
          className={`py-1.5 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm ${
            badgeColors[statusMeta.tone]
          }`}
        >
          {statusMeta.tone === "warning" ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
          )}
          {statusMeta.text}
        </span>
      </div>

      <div className="h-1.5 bg-[#1A1D24] rounded-full overflow-hidden mb-2">
        <motion.div
          className={`h-full rounded-full ${progressFillClass}`}
          initial={false}
          animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>

      <div className="text-xs font-medium text-gray-500 flex justify-between tracking-wide uppercase">
        <span>{stage !== "IDLE" ? stage.replace(/_/g, " ") : "WAITING"}</span>
        <span
          className={
            completed ? "text-emerald-400" : failed ? "text-rose-400" : "text-blue-400"
          }
        >
          {progress}%
        </span>
      </div>

      <TimelineFeed
        timeline={timeline}
        latestEventId={latestEventId}
        timelineEndRef={timelineEndRef}
      />

      {(analysisRequestId || workerId) && (
        <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-[#1A1D24] text-[11px] text-gray-500">
          {analysisRequestId && (
            <span className="flex items-center gap-1.5">
              REQ{" "}
              <code className="text-[10.5px] bg-[#1A1D24] text-gray-300 py-0.5 px-1.5 rounded border border-[#2B303B] font-mono">
                {analysisRequestId}
              </code>
            </span>
          )}
          {workerId && (
            <span className="flex items-center gap-1.5">
              NODE{" "}
              <code className="text-[10.5px] bg-[#1A1D24] text-gray-300 py-0.5 px-1.5 rounded border border-[#2B303B] font-mono">
                {workerId}
              </code>
            </span>
          )}
        </div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex gap-3 items-start shadow-inner shadow-rose-500/5"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </motion.div>
      )}
    </div>
  );
}