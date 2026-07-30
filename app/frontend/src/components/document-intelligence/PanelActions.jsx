"use client";

import { FileText, RefreshCw, Sparkles } from "lucide-react";

export default function PanelActions({
  busy,
  activeTab,
  selectedFile,
  onLoadSample,
  onAnalyze,
  onClearFile,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
      <button
        type="button"
        className="w-full min-w-0 py-2.5 px-4 rounded-xl border border-[#2B303B] bg-[#1A1D24] text-gray-200 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[#252A34] transition-colors"
        onClick={onLoadSample}
      >
        <FileText size={16} className="text-gray-400 shrink-0" />
        <span className="truncate">Load sample</span>
      </button>

      <button
        type="button"
        className="w-full min-w-0 py-2.5 px-4 rounded-xl border-none bg-blue-600 text-white text-sm font-semibold inline-flex justify-center items-center gap-2 hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 disabled:bg-[#2B303B] disabled:text-gray-500 disabled:shadow-none"
        onClick={onAnalyze}
        disabled={busy}
      >
        {busy ? (
          <>
            <RefreshCw size={16} className="animate-spin shrink-0" />
            <span className="truncate">
              {activeTab === "upload" && selectedFile
                ? "Uploading"
                : "Processing"}
            </span>
          </>
        ) : (
          <>
            <Sparkles size={16} className="shrink-0" />
            <span className="truncate">Run Analysis</span>
          </>
        )}
      </button>
    </div>
  );
}
