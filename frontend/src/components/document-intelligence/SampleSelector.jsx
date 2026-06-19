"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function SampleSelector({
  sampleDocuments,
  selectedSample,
  onSelectSample,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selectedDoc = sampleDocuments.find((d) => d.id === selectedSample);

  useEffect(() => {
    function handleClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        type="button"
        className="w-full min-w-0 flex items-center justify-between gap-2 py-2.5 px-3.5 rounded-xl border border-[#2B303B] bg-[#1A1D24] text-sm text-gray-200 hover:bg-[#252A34] transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate min-w-0 text-left pr-2">
          {selectedDoc?.label || "Select Sample"}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-400 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 z-20 mt-2 border border-[#2B303B] rounded-xl bg-[#1A1D24] shadow-xl shadow-black/50 overflow-hidden backdrop-blur-xl"
          >
            <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
              {sampleDocuments.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  className="w-full text-left py-2.5 px-3.5 border-b border-[#2B303B] last:border-b-0 hover:bg-[#252A34] transition-colors"
                  onClick={() => {
                    onSelectSample(doc.id);
                    setOpen(false);
                  }}
                >
                  <div className="font-medium text-sm text-gray-200 flex items-center gap-2">
                    <FileText size={14} className="text-gray-400 shrink-0" />
                    {doc.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {doc.description}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
