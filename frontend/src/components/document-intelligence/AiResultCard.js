"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Calendar,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  Link as LinkIcon,
  UserCheck,
  Info
} from "lucide-react";

export default function AiResultCard({ result }) {
  if (!result) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mt-6 border border-[#2B303B] rounded-[20px] bg-[#0B0D10] overflow-hidden shadow-lg shadow-black/20"
      >
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-500/10 to-transparent border-b border-[#2B303B] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-medium text-base tracking-tight">
              AI Analysis Results
            </h3>
          </div>
          {result.status && (
            <span className="text-[11px] font-medium uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
              {result.status}
            </span>
          )}
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Executive Summary */}
          {result.summary && (
            <section>
              <h4 className="text-sm font-semibold text-gray-300 mb-2.5 flex items-center gap-2">
                <Info className="w-4 h-4 text-gray-500" />
                Executive Summary
              </h4>
              <div className="bg-[#13151A] border border-[#2B303B] rounded-xl p-4 text-sm text-gray-300 leading-relaxed">
                {result.summary}
              </div>
            </section>
          )}

          {/* Grid for Deadlines & Action Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Action Items */}
            {result.actionItems?.length > 0 && (
              <section>
                <h4 className="text-sm font-semibold text-gray-300 mb-2.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Action Items
                </h4>
                <ul className="space-y-2">
                  {result.actionItems.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 bg-[#13151A] border border-[#2B303B] p-3 rounded-lg text-sm text-gray-300"
                    >
                      <div className="mt-0.5 min-w-[16px]">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />
                      </div>
                      <span>{typeof item === 'string' ? item : item.task || JSON.stringify(item)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Key Deadlines */}
            {result.keyDeadlines?.length > 0 && (
              <section>
                <h4 className="text-sm font-semibold text-gray-300 mb-2.5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-rose-400" />
                  Key Deadlines
                </h4>
                <ul className="space-y-2">
                  {result.keyDeadlines.map((deadline, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 bg-[#13151A] border border-[#2B303B] p-3 rounded-lg text-sm text-gray-300"
                    >
                      <div className="mt-0.5 min-w-[16px]">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5" />
                      </div>
                      <span>{typeof deadline === 'string' ? deadline : deadline.date || JSON.stringify(deadline)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Questions to Ask */}
          {result.questionsToAsk?.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-gray-300 mb-2.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                Questions to Ask
              </h4>
              <div className="bg-[#13151A] border border-[#2B303B] rounded-xl p-1">
                {result.questionsToAsk.map((question, idx) => (
                  <div
                    key={idx}
                    className={`p-3 text-sm text-gray-300 ${
                      idx !== result.questionsToAsk.length - 1
                        ? "border-b border-[#2B303B]"
                        : ""
                    }`}
                  >
                    <span className="text-amber-500 font-medium mr-2">Q:</span>
                    {typeof question === 'string' ? question : question.text || JSON.stringify(question)}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer / Metadata */}
        <div className="bg-[#13151A] border-t border-[#2B303B] px-5 py-3 flex flex-wrap items-center gap-4 text-xs text-gray-400">
         {result.aiConfidence && (
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                Confidence:{" "}
                {Math.round(
                  (typeof result.aiConfidence === "number"
                    ? result.aiConfidence
                    : result.aiConfidence.overall ?? 0) * 100
                )}
                %
              </span>
            </div>
          )}

          {result.humanReview?.required && (
            <div className="flex items-center gap-1.5" title={result.humanReview.reason}>
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Human Review Recommended</span>
            </div>
          )}

          {result.trustedSources?.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <LinkIcon className="w-3.5 h-3.5 text-gray-500" />
              <span>{result.trustedSources.length} Sources Referenced</span>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}