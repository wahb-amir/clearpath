"use client";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Image, Type, ChevronDown, Sparkles, RefreshCw, FileStack } from "lucide-react";
import { sampleDocuments } from "@/lib/mockData";
import { SampleDocument } from "@/lib/types";
import dynamic from "next/dynamic";
import { useIsMobile } from "@/lib/useIsMobile";

const ScanAnimation = dynamic(() => import("@/components/3d/ScanAnimation"), { ssr: false });

interface UploadPanelProps {
  onAnalyze: (doc: SampleDocument) => void;
  analyzing: boolean;
  currentDoc: SampleDocument | null;
}

export default function UploadPanel({ onAnalyze, analyzing, currentDoc }: UploadPanelProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedSample, setSelectedSample] = useState<string>(sampleDocuments[0].id);
  const [pasteText, setPasteText] = useState("");
  const [showSampleDropdown, setShowSampleDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const isMobile = useIsMobile();

  const handleAnalyze = () => {
    const doc = sampleDocuments.find((d) => d.id === selectedSample) || sampleDocuments[0];
    onAnalyze(doc);
  };

  const handleLoadSample = () => {
    const doc = sampleDocuments.find((d) => d.id === selectedSample) || sampleDocuments[0];
    setPasteText(doc.preview);
    setActiveTab("paste");
  };

  const tabs = [
    { id: "upload", label: "Upload File", icon: Upload },
    { id: "paste", label: "Paste Text", icon: Type },
  ] as const;

  const selectedDoc = sampleDocuments.find((d) => d.id === selectedSample);

  return (
    <div
      style={{
        background: "hsla(222, 35%, 10%, 0.85)",
        border: "1px solid hsla(222, 25%, 16%, 0.8)",
        borderRadius: "20px",
        overflow: "hidden",
        position: "sticky",
        top: "80px",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: "1.25rem 1.5rem 1rem",
          borderBottom: "1px solid hsla(222, 25%, 14%, 0.8)",
          background: "hsla(222, 40%, 7%, 0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
          <FileStack size={18} color="hsl(191, 100%, 50%)" />
          <h2 style={{ color: "hsl(220, 20%, 92%)", fontWeight: 700, fontSize: "1.0625rem", fontFamily: "Outfit, sans-serif", letterSpacing: "-0.01em" }}>
            Analyze Your Document
          </h2>
        </div>
        <p style={{ color: "hsl(220, 8%, 50%)", fontSize: "0.8rem", lineHeight: 1.5 }}>
          Paste a letter, upload a file, or load a sample notice to get started.
        </p>
      </div>

      <div style={{ padding: "1.25rem 1.5rem" }}>
        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            background: "hsla(222, 40%, 7%, 0.6)",
            borderRadius: "10px",
            padding: "3px",
            marginBottom: "1.125rem",
            border: "1px solid hsla(222, 25%, 14%, 0.8)",
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "7px",
                  border: "none",
                  cursor: "pointer",
                  background: activeTab === tab.id ? "hsla(221, 83%, 53%, 0.15)" : "transparent",
                  color: activeTab === tab.id ? "hsl(191, 100%, 50%)" : "hsl(220, 8%, 45%)",
                  fontSize: "0.8rem",
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  transition: "all 0.2s ease",
                }}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "upload" ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {/* Drop zone */}
              <motion.div
                animate={{
                  borderColor: dragOver
                    ? "hsla(221, 83%, 53%, 0.7)"
                    : "hsla(222, 25%, 18%, 0.8)",
                  background: dragOver
                    ? "hsla(221, 83%, 53%, 0.05)"
                    : "hsla(222, 40%, 7%, 0.4)",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
                style={{
                  border: "2px dashed hsla(222, 25%, 18%, 0.8)",
                  borderRadius: "14px",
                  padding: "2rem 1.5rem",
                  textAlign: "center",
                  cursor: "pointer",
                  marginBottom: "1rem",
                  transition: "all 0.25s ease",
                  minHeight: isMobile ? "160px" : "200px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.75rem",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {analyzing && !isMobile ? (
                  <div style={{ width: "100%", height: "160px", position: "relative" }}>
                    <ScanAnimation scanning={analyzing} />
                  </div>
                ) : (
                  <>
                    <motion.div
                      animate={{ scale: dragOver ? 1.15 : 1, rotate: dragOver ? 10 : 0 }}
                      style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "14px",
                        background: "hsla(221, 83%, 53%, 0.1)",
                        border: "1px solid hsla(221, 83%, 53%, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Upload size={22} color="hsl(191, 100%, 50%)" />
                    </motion.div>
                    <div>
                      <p style={{ color: "hsl(220, 12%, 75%)", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                        {dragOver ? "Drop it here!" : "Drag & drop or click to upload"}
                      </p>
                      <p style={{ color: "hsl(220, 8%, 45%)", fontSize: "0.75rem" }}>
                        Supports PDF, JPG, PNG, screenshots
                      </p>
                    </div>
                    {/* File type badges */}
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
                      {["PDF", "JPG", "PNG", "Screenshot"].map((type) => (
                        <span
                          key={type}
                          style={{
                            padding: "0.2rem 0.55rem",
                            borderRadius: "5px",
                            background: "hsla(222, 35%, 14%, 0.8)",
                            border: "1px solid hsla(222, 25%, 18%, 0.6)",
                            color: "hsl(220, 8%, 50%)",
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="paste"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your document text, letter content, or school notice here..."
                style={{
                  width: "100%",
                  minHeight: isMobile ? "160px" : "200px",
                  background: "hsla(222, 40%, 7%, 0.6)",
                  border: "1px solid hsla(222, 25%, 16%, 0.8)",
                  borderRadius: "12px",
                  padding: "1rem",
                  color: "hsl(220, 12%, 80%)",
                  fontSize: "0.85rem",
                  lineHeight: 1.65,
                  fontFamily: "Inter, sans-serif",
                  resize: "vertical",
                  outline: "none",
                  marginBottom: "1rem",
                  transition: "border-color 0.2s ease",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "hsla(221, 83%, 53%, 0.4)")}
                onBlur={(e) => (e.target.style.borderColor = "hsla(222, 25%, 16%, 0.8)")}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sample selector */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", color: "hsl(220, 8%, 50%)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            Or try a sample document
          </label>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowSampleDropdown(!showSampleDropdown)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                background: "hsla(222, 40%, 7%, 0.6)",
                border: "1px solid hsla(222, 25%, 16%, 0.8)",
                borderRadius: "10px",
                cursor: "pointer",
                color: "hsl(220, 12%, 78%)",
                fontSize: "0.85rem",
                fontWeight: 500,
                textAlign: "left",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <span style={{ fontSize: "1rem" }}>{selectedDoc?.icon}</span>
                <span>{selectedDoc?.label}</span>
              </div>
              <motion.div animate={{ rotate: showSampleDropdown ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={16} color="hsl(220, 8%, 50%)" />
              </motion.div>
            </button>

            <AnimatePresence>
              {showSampleDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                    background: "hsl(222, 40%, 8%)",
                    border: "1px solid hsla(222, 25%, 18%, 0.9)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    zIndex: 50,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                  }}
                >
                  {sampleDocuments.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setSelectedSample(doc.id);
                        setShowSampleDropdown(false);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.75rem",
                        padding: "0.875rem 1rem",
                        background: selectedSample === doc.id ? "hsla(221, 83%, 53%, 0.08)" : "transparent",
                        border: "none",
                        borderBottom: "1px solid hsla(222, 25%, 14%, 0.5)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "hsla(222, 35%, 12%, 0.8)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = selectedSample === doc.id ? "hsla(221, 83%, 53%, 0.08)" : "transparent")}
                    >
                      <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>{doc.icon}</span>
                      <div>
                        <div style={{ color: "hsl(220, 12%, 82%)", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.2rem" }}>{doc.label}</div>
                        <div style={{ color: "hsl(220, 8%, 45%)", fontSize: "0.75rem", lineHeight: 1.4 }}>{doc.description}</div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.625rem" }}>
          <motion.button
            onClick={handleAnalyze}
            disabled={analyzing}
            whileHover={!analyzing ? { scale: 1.02, boxShadow: "0 8px 30px hsla(221, 83%, 53%, 0.35)" } : {}}
            whileTap={!analyzing ? { scale: 0.98 } : {}}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.875rem 1.25rem",
              borderRadius: "12px",
              background: analyzing
                ? "hsla(221, 83%, 53%, 0.4)"
                : "linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(221, 83%, 53%) 100%)",
              border: "none",
              color: "white",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: analyzing ? "not-allowed" : "pointer",
              transition: "all 0.25s ease",
              boxShadow: analyzing ? "none" : "0 4px 20px hsla(221, 83%, 53%, 0.2)",
            }}
          >
            {analyzing ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <RefreshCw size={16} />
                </motion.div>
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Analyze Document
              </>
            )}
          </motion.button>

          <motion.button
            onClick={handleLoadSample}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              padding: "0.875rem 1rem",
              borderRadius: "12px",
              background: "hsla(222, 35%, 12%, 0.8)",
              border: "1px solid hsla(222, 25%, 18%, 0.8)",
              color: "hsl(220, 10%, 65%)",
              fontWeight: 600,
              fontSize: "0.82rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
            }}
          >
            <FileText size={14} />
            Load Sample
          </motion.button>
        </div>
      </div>
    </div>
  );
}
