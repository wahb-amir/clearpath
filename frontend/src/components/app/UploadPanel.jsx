"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Type,
  ChevronDown,
  Sparkles,
  RefreshCw,
  FileStack,
} from "lucide-react";
import { sampleDocuments } from "@/lib/mockData";
import dynamic from "next/dynamic";
import { useIsMobile } from "@/lib/useIsMobile";

const ScanAnimation = dynamic(() => import("@/components/3d/ScanAnimation"), {
  ssr: false,
});

export default function UploadPanel({ onAnalyze, analyzing }) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedSample, setSelectedSample] = useState(sampleDocuments[0].id);
  const [pasteText, setPasteText] = useState("");
  const [showSampleDropdown, setShowSampleDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");
  const isMobile = useIsMobile();

  const handleAnalyze = () => {
    const doc =
      sampleDocuments.find((d) => d.id === selectedSample) ||
      sampleDocuments[0];
    onAnalyze(doc);
  };

  const handleLoadSample = () => {
    const doc =
      sampleDocuments.find((d) => d.id === selectedSample) ||
      sampleDocuments[0];
    setPasteText(doc.preview);
    setActiveTab("paste");
  };

  const selectedDoc = sampleDocuments.find(
    (d) => d.id === selectedSample
  );

  return (
    <div style={{ position: "sticky", top: "80px" }}>
      {/* HEADER */}
      <div style={{ padding: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <FileStack size={18} />
          <h2>Analyze Your Document</h2>
        </div>
      </div>

      <div style={{ padding: "1rem" }}>
        {/* TABS */}
        <div style={{ display: "flex" }}>
          {[
            { id: "upload", label: "Upload File", icon: Upload },
            { id: "paste", label: "Paste Text", icon: Type },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id )}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* CONTENT */}
        <AnimatePresence mode="wait">
          {activeTab === "upload" ? (
            <motion.div key="upload">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                }}
              >
                {analyzing && !isMobile ? (
                  <ScanAnimation scanning={analyzing} />
                ) : (
                  <div>
                    <Upload size={22} />
                    <p>Drag & drop or click to upload</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="paste">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste document..."
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* SAMPLE SELECTOR */}
        <div style={{ position: "relative", marginTop: "1rem" }}>
          <button
            onClick={() => setShowSampleDropdown((v) => !v)}
          >
            <span>{selectedDoc?.label}</span>
            <ChevronDown size={16} />
          </button>

          <AnimatePresence>
            {showSampleDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{
                  position: "absolute",
                  width: "100%",
                }}
              >
                {sampleDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setSelectedSample(doc.id);
                      setShowSampleDropdown(false);
                    }}
                  >
                    <div>
                      <div>{doc.label}</div>
                      <div>{doc.description}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ACTIONS */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? (
              <>
                <RefreshCw size={16} /> Analyzing...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Analyze
              </>
            )}
          </button>

          <button onClick={handleLoadSample}>
            <FileText size={14} /> Load Sample
          </button>
        </div>
      </div>
    </div>
  );
}