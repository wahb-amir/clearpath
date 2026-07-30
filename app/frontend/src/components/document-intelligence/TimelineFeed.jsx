"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Activity } from "lucide-react";
import { EVENT_LABELS, timeAgo } from "./constants";

export default function TimelineFeed({
  timeline,
  latestEventId,
  timelineEndRef,
}) {
  return (
    <div className="mt-8 border-t border-[#2B303B] pt-5">
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-sm text-gray-200 flex items-center gap-2">
          <Activity size={16} className="text-blue-400" /> Events
        </span>
        <span className="text-xs font-medium text-gray-500 bg-[#1A1D24] py-1 px-2.5 rounded-full border border-[#2B303B]">
          {timeline.length} Event{timeline.length !== 1 && "s"}
        </span>
      </div>

      <div
        className="relative flex flex-col gap-0 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar"
        ref={timelineEndRef}
      >
        {timeline.length === 0 ? (
          <div className="py-8 px-4 text-center text-sm text-gray-500 border border-dashed border-[#2B303B] rounded-xl bg-[#13151A]">
            Awaiting execution triggers. Logs will appear dynamically.
          </div>
        ) : (
          <LayoutGroup>
            <AnimatePresence initial={false}>
              {timeline.map((item, idx) => {
                const isLast = idx === timeline.length - 1;
                const isLatest = item.eventId === latestEventId;

                const dotToneClass =
                  item.stage === "FAILED"
                    ? "bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.15)]"
                    : item.stage === "COMPLETED"
                      ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
                      : "bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.15)]";

                return (
                  <motion.div
                    key={item.eventId}
                    layout
                    initial={{ opacity: 0, x: -10, filter: "blur(4px)" }}
                    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="relative flex gap-3.5 py-2.5 group"
                  >
                    <div className="flex flex-col items-center w-5 shrink-0">
                      <motion.span
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 z-10 ${dotToneClass}`}
                        animate={
                          isLatest ? { scale: [1, 1.5, 1] } : { scale: 1 }
                        }
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                      />
                      {!isLast && (
                        <span className="w-px flex-1 bg-[#2B303B] mt-1.5 group-hover:bg-[#3A4150] transition-colors" />
                      )}
                    </div>

                    <div className="flex-1 pb-1">
                      <div className="flex justify-between gap-3 items-baseline">
                        <span
                          className={`text-[13px] font-medium ${
                            isLatest ? "text-white" : "text-gray-300"
                          }`}
                        >
                          {item.label || EVENT_LABELS[item.name] || item.name}
                        </span>
                        <span className="text-[11px] text-gray-500 whitespace-nowrap shrink-0 font-mono tracking-tight">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>

                      {item.message && (
                        <div className="text-xs text-gray-400 mt-1 leading-relaxed">
                          {item.message}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </LayoutGroup>
        )}
      </div>
    </div>
  );
}
