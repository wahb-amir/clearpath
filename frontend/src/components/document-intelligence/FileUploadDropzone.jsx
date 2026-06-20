"use client";

import { useRef } from "react";
import { Upload, X } from "lucide-react";
import { formatBytes } from "./constants";

export default function FileUploadDropzone({
  busy,
  isMobile,
  selectedFile,
  onSelectFile,
  onClearFile,
  ScanAnimation,
}) {
  const inputRef = useRef(null);

  const openPicker = () => {
    if (busy) return;
    inputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) onSelectFile(file);
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (busy) return;

    const file = event.dataTransfer.files?.[0];
    if (file) onSelectFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) e.currentTarget.dataset.drag = "true";
      }}
      onDragLeave={(e) => {
        e.currentTarget.dataset.drag = "false";
      }}
      onDrop={handleDrop}
      className="mt-5 min-h-[180px] rounded-[18px] border-2 border-dashed flex items-center justify-center p-6 transition-all duration-200 border-[#2B303B] bg-[#0B0D10] hover:border-[#3A4150] data-[drag=true]:border-blue-500 data-[drag=true]:bg-blue-500/10"
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={handleFileChange}
        disabled={busy}
      />

      {busy && !isMobile ? (
        <ScanAnimation scanning={busy} />
      ) : (
        <div className="w-full max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-[#1A1D24] border border-[#2B303B] flex items-center justify-center mx-auto mb-3">
            <Upload size={20} className="text-blue-400" />
          </div>

          <p className="m-0 text-sm font-medium text-gray-200">
            Drag & drop to upload
          </p>
          <p className="m-0 text-xs text-gray-500 mt-1">
            PDF, DOCX, TXT up to 20MB
          </p>

          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
            <button
              type="button"
              onClick={openPicker}
              disabled={busy}
              className="py-2 px-4 rounded-xl border border-[#2B303B] bg-[#1A1D24] text-gray-200 text-sm font-medium hover:bg-[#252A34] transition-colors disabled:opacity-50"
            >
              Choose file
            </button>

            {selectedFile && (
              <button
                type="button"
                onClick={onClearFile}
                disabled={busy}
                className="py-2 px-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-sm font-medium hover:bg-rose-500/15 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <X size={14} />
                Clear file
              </button>
            )}
          </div>

          {selectedFile && (
            <div className="mt-4 mx-auto max-w-[90%] rounded-xl border border-[#2B303B] bg-[#13151A] px-3 py-2 text-left">
              <div className="text-sm font-medium text-gray-200 truncate">
                {selectedFile.name}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {formatBytes(selectedFile.size)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
