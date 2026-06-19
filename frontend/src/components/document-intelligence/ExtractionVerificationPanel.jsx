"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Phone,
  DollarSign,
  Hash,
  FileText,
  ChevronDown,
  ChevronUp,
  Edit3,
  Loader2,
  ShieldCheck,
  Eye,
  BookOpen,
  Trash2,
  Plus,
  X,
  Minimize2,
} from "lucide-react";

// ─── Pill badge ───────────────────────────────────────────────────────────────
function Badge({ children, color = "blue" }) {
  const colors = {
    blue: "bg-blue-500/15 text-blue-300 border-blue-500/20",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/20",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    rose: "bg-rose-500/15 text-rose-300 border-rose-500/20",
    violet: "bg-violet-500/15 text-violet-300 border-violet-500/20",
    cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[color]}`}
    >
      {children}
    </span>
  );
}

// ─── Confidence dot ──────────────────────────────────────────────────────────
function ConfidenceDot({ value }) {
  const pct = Math.round((value ?? 0) * 100);
  const color =
    pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-rose-400";
  return (
    <span className="flex items-center gap-1 text-[10px] text-gray-500">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {pct}% confidence
    </span>
  );
}

// ─── Styled Premium Input Field ──────────────────────────────────────────────
function CleanInputField({
  value,
  onChange,
  multiline = false,
  placeholder,
  onFocus,
  rows = 3,
}) {
  const className =
    "w-full rounded-xl border border-white/10 bg-[#0f1318] px-3.5 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder-gray-600 resize-y min-h-[40px] font-sans";

  return multiline ? (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      rows={rows}
      onFocus={onFocus}
    />
  ) : (
    <input
      type="text"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      onFocus={onFocus}
    />
  );
}

// ─── Collapsible section ─────────────────────────────────────────────────────
function Section({
  title,
  icon: Icon,
  count,
  color = "blue",
  children,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colorMap = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  };
  return (
    <div className="rounded-2xl border border-white/5 bg-[#0b0d12] shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span
          className={`grid h-8 w-8 place-items-center rounded-xl border ${colorMap[color]}`}
        >
          <Icon size={14} />
        </span>
        <span className="flex-1 text-sm font-semibold text-gray-200">
          {title}
        </span>
        {count !== undefined && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-gray-400">
            {count}
          </span>
        )}
        {open ? (
          <ChevronUp size={16} className="text-gray-500" />
        ) : (
          <ChevronDown size={16} className="text-gray-500" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5 px-5 py-4 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Text highlighting utility ─────────────────────────────────────────────
function renderHighlightedText(text, highlight) {
  if (!highlight || !text) return text;

  const cleanHighlight = highlight.replace(/^…|…$/g, "").trim();
  if (!cleanHighlight) return text;

  const index = text.toLowerCase().indexOf(cleanHighlight.toLowerCase());
  if (index === -1) return text;

  const before = text.substring(0, index);
  const match = text.substring(index, index + cleanHighlight.length);
  const after = text.substring(index + cleanHighlight.length);

  return (
    <>
      {before}
      <mark className="bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 px-1 py-0.5 rounded shadow-lg shadow-cyan-500/5 transition-all font-mono font-semibold">
        {match}
      </mark>
      {after}
    </>
  );
}

// ─── Left panel: original document preview ──────────────────────────────────
function DocumentPreviewPane({ extractedContent, fileName, activeContext }) {
  const containerRef = useRef(null);

  // Auto-scroll to highlight when activeContext changes
  useEffect(() => {
    if (activeContext && containerRef.current) {
      const cleanHighlight = activeContext.replace(/^…|…$/g, "").trim();
      if (cleanHighlight) {
        const markElement = containerRef.current.querySelector("mark");
        if (markElement) {
          markElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  }, [activeContext]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/5 bg-[#0d1017]/80 px-5 py-3.5">
        <div className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
          <Eye size={13} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-200">
            Original Document
          </p>
          <p className="text-[10px] text-gray-500">
            {fileName ?? "Extracted text preview"}
          </p>
        </div>
      </div>

      {/* Scrollable body */}
      <div
        ref={containerRef}
        className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5 bg-[#07090e]"
      >
        {extractedContent?.rawTextPreview ? (
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-gray-400 select-text">
            {renderHighlightedText(
              extractedContent.rawTextPreview,
              activeContext,
            )}
            {extractedContent.rawTextPreview.length >= 3000 && (
              <span className="mt-3 block text-[10px] italic text-gray-600 font-sans">
                [Preview truncated at 3,000 chars — full document processed by
                AI]
              </span>
            )}
          </pre>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText size={32} className="mb-3 text-gray-700" />
            <p className="text-sm text-gray-500">No text preview available</p>
          </div>
        )}
      </div>

      {/* Footer meta */}
      <div className="shrink-0 border-t border-white/5 bg-[#0d1017]/50 px-5 py-3">
        <div className="flex flex-wrap gap-4 text-[10px] text-gray-500">
          {extractedContent?.language && (
            <span>
              Language:{" "}
              <span className="text-gray-300 font-semibold">
                {extractedContent.language.toUpperCase()}
              </span>
            </span>
          )}
          {extractedContent?.ocrConfidence != null && (
            <span>
              OCR confidence:{" "}
              <span className="text-gray-300 font-semibold">
                {Math.round(extractedContent.ocrConfidence * 100)}%
              </span>
            </span>
          )}
          {extractedContent?.quality && (
            <span>
              Quality:{" "}
              <span className="text-gray-300 font-semibold">
                {extractedContent.quality}
              </span>
            </span>
          )}
          {extractedContent?.extractionMethod && (
            <span>
              Method:{" "}
              <span className="text-gray-300 font-semibold">
                {extractedContent.extractionMethod}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Right panel: editable extracted content ─────────────────────────────────
function ExtractedContentEditor({ content, onChange, setActiveContext }) {
  const update = useCallback(
    (patch) => onChange((prev) => ({ ...prev, ...patch })),
    [onChange],
  );

  const updateDate = (idx, field, val) =>
    onChange((prev) => {
      const dates = [...(prev.dates ?? [])];
      dates[idx] = { ...dates[idx], [field]: val };
      return { ...prev, dates };
    });

  const deleteDate = (idx) =>
    onChange((prev) => {
      const dates = (prev.dates ?? []).filter((_, i) => i !== idx);
      return { ...prev, dates };
    });

  const addDate = () =>
    onChange((prev) => {
      const dates = [
        ...(prev.dates ?? []),
        {
          factType: "date",
          value: "",
          normalizedValue: "",
          confidence: 1.0,
          context: "",
        },
      ];
      return { ...prev, dates };
    });

  const updateContact = (idx, field, val) =>
    onChange((prev) => {
      const contacts = [...(prev.contacts ?? [])];
      contacts[idx] = { ...contacts[idx], [field]: val };
      return { ...prev, contacts };
    });

  const deleteContact = (idx) =>
    onChange((prev) => {
      const contacts = (prev.contacts ?? []).filter((_, i) => i !== idx);
      return { ...prev, contacts };
    });

  const addContact = () =>
    onChange((prev) => {
      const contacts = [
        ...(prev.contacts ?? []),
        { factType: "contact", value: "", confidence: 1.0, context: "" },
      ];
      return { ...prev, contacts };
    });

  const updateAmount = (idx, field, val) =>
    onChange((prev) => {
      const amounts = [...(prev.amounts ?? [])];
      amounts[idx] = { ...amounts[idx], [field]: val };
      return { ...prev, amounts };
    });

  const deleteAmount = (idx) =>
    onChange((prev) => {
      const amounts = (prev.amounts ?? []).filter((_, i) => i !== idx);
      return { ...prev, amounts };
    });

  const addAmount = () =>
    onChange((prev) => {
      const amounts = [
        ...(prev.amounts ?? []),
        { value: "", confidence: 1.0, context: "" },
      ];
      return { ...prev, amounts };
    });

  const updateReferenceId = (idx, field, val) =>
    onChange((prev) => {
      const referenceIds = [...(prev.referenceIds ?? [])];
      referenceIds[idx] = { ...referenceIds[idx], [field]: val };
      return { ...prev, referenceIds };
    });

  const deleteReferenceId = (idx) =>
    onChange((prev) => {
      const referenceIds = (prev.referenceIds ?? []).filter(
        (_, i) => i !== idx,
      );
      return { ...prev, referenceIds };
    });

  const addReferenceId = () =>
    onChange((prev) => {
      const referenceIds = [
        ...(prev.referenceIds ?? []),
        { value: "", confidence: 1.0, context: "" },
      ];
      return { ...prev, referenceIds };
    });

  const updateSection = (idx, field, val) =>
    onChange((prev) => {
      const sections = [...(prev.sections ?? [])];
      sections[idx] = { ...sections[idx], [field]: val };
      return { ...prev, sections };
    });

  const deleteSection = (idx) =>
    onChange((prev) => {
      const sections = (prev.sections ?? []).filter((_, i) => i !== idx);
      return { ...prev, sections };
    });

  const addSection = () =>
    onChange((prev) => {
      const sections = [...(prev.sections ?? []), { title: "", content: "" }];
      return { ...prev, sections };
    });

  return (
    <div className="custom-scrollbar flex flex-col gap-4 overflow-y-auto px-6 py-5">
      {/* Document title + summary */}
      <Section
        title="Document Overview"
        icon={BookOpen}
        color="cyan"
        defaultOpen
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Title
            </label>
            <CleanInputField
              value={content?.title ?? ""}
              onChange={(v) => update({ title: v })}
              placeholder="Document title..."
              onFocus={() => setActiveContext(null)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Summary
            </label>
            <CleanInputField
              value={content?.summary ?? ""}
              onChange={(v) => update({ summary: v })}
              multiline
              rows={14}
              placeholder="Document summary..."
              onFocus={() => setActiveContext(null)}
            />
          </div>
        </div>
      </Section>

      {/* Dates / Deadlines */}
      <Section
        title="Dates & Deadlines"
        icon={Calendar}
        color="amber"
        count={content?.dates?.length ?? 0}
        defaultOpen
      >
        <div className="space-y-4">
          {(content?.dates ?? []).map((d, i) => (
            <div
              key={i}
              className="group relative rounded-xl border border-white/5 bg-[#07090e] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge color={d.factType === "deadline" ? "rose" : "amber"}>
                    {d.factType ?? "date"}
                  </Badge>
                  <ConfidenceDot value={d.confidence} />
                </div>
                <button
                  type="button"
                  onClick={() => deleteDate(i)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  title="Delete Date"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                    Fact Type
                  </label>
                  <CleanInputField
                    value={d.factType ?? ""}
                    onChange={(v) => updateDate(i, "factType", v)}
                    placeholder="e.g. deadline, date..."
                    onFocus={() => setActiveContext(d.context)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                    Detected Value
                  </label>
                  <CleanInputField
                    value={d.value ?? ""}
                    onChange={(v) => updateDate(i, "value", v)}
                    placeholder="Date value..."
                    onFocus={() => setActiveContext(d.context)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                  Normalized (ISO YYYY-MM-DD)
                </label>
                <CleanInputField
                  value={d.normalizedValue ?? ""}
                  onChange={(v) => updateDate(i, "normalizedValue", v)}
                  placeholder="YYYY-MM-DD"
                  onFocus={() => setActiveContext(d.context)}
                />
              </div>

              <div>
                <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                  Context in Document
                </label>
                <CleanInputField
                  value={d.context ?? ""}
                  onChange={(v) => updateDate(i, "context", v)}
                  multiline
                  placeholder="Context snippet..."
                  onFocus={() => setActiveContext(d.context)}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addDate}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 hover:border-white/20 py-2.5 text-xs text-gray-400 hover:text-gray-200 transition"
          >
            <Plus size={13} /> Add Date
          </button>
        </div>
      </Section>

      {/* Contacts */}
      <Section
        title="Contacts"
        icon={Phone}
        color="emerald"
        count={content?.contacts?.length ?? 0}
        defaultOpen
      >
        <div className="space-y-4">
          {(content?.contacts ?? []).map((c, i) => (
            <div
              key={i}
              className="group relative rounded-xl border border-white/5 bg-[#07090e] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge color="emerald">{c.factType ?? "contact"}</Badge>
                  <ConfidenceDot value={c.confidence} />
                </div>
                <button
                  type="button"
                  onClick={() => deleteContact(i)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  title="Delete Contact"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                    Fact Type
                  </label>
                  <CleanInputField
                    value={c.factType ?? ""}
                    onChange={(v) => updateContact(i, "factType", v)}
                    placeholder="e.g. email, phone, address..."
                    onFocus={() => setActiveContext(c.context)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                    Value
                  </label>
                  <CleanInputField
                    value={c.value ?? ""}
                    onChange={(v) => updateContact(i, "value", v)}
                    placeholder="Value..."
                    onFocus={() => setActiveContext(c.context)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                  Context in Document
                </label>
                <CleanInputField
                  value={c.context ?? ""}
                  onChange={(v) => updateContact(i, "context", v)}
                  multiline
                  placeholder="Context snippet..."
                  onFocus={() => setActiveContext(c.context)}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addContact}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 hover:border-white/20 py-2.5 text-xs text-gray-400 hover:text-gray-200 transition"
          >
            <Plus size={13} /> Add Contact
          </button>
        </div>
      </Section>

      {/* Amounts */}
      <Section
        title="Amounts"
        icon={DollarSign}
        color="violet"
        count={content?.amounts?.length ?? 0}
        defaultOpen={false}
      >
        <div className="space-y-4">
          {(content?.amounts ?? []).map((a, i) => (
            <div
              key={i}
              className="group relative rounded-xl border border-white/5 bg-[#07090e] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <ConfidenceDot value={a.confidence} />
                <button
                  type="button"
                  onClick={() => deleteAmount(i)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  title="Delete Amount"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div>
                <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                  Value
                </label>
                <CleanInputField
                  value={a.value ?? ""}
                  onChange={(v) => updateAmount(i, "value", v)}
                  placeholder="Amount value..."
                  onFocus={() => setActiveContext(a.context)}
                />
              </div>

              <div>
                <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                  Context in Document
                </label>
                <CleanInputField
                  value={a.context ?? ""}
                  onChange={(v) => updateAmount(i, "context", v)}
                  multiline
                  placeholder="Context snippet..."
                  onFocus={() => setActiveContext(a.context)}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addAmount}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 hover:border-white/20 py-2.5 text-xs text-gray-400 hover:text-gray-200 transition"
          >
            <Plus size={13} /> Add Amount
          </button>
        </div>
      </Section>

      {/* Reference IDs */}
      <Section
        title="Reference IDs"
        icon={Hash}
        color="blue"
        count={content?.referenceIds?.length ?? 0}
        defaultOpen={false}
      >
        <div className="space-y-4">
          {(content?.referenceIds ?? []).map((r, i) => (
            <div
              key={i}
              className="group relative rounded-xl border border-white/5 bg-[#07090e] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <ConfidenceDot value={r.confidence} />
                <button
                  type="button"
                  onClick={() => deleteReferenceId(i)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  title="Delete Reference ID"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div>
                <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                  Value
                </label>
                <CleanInputField
                  value={r.value ?? ""}
                  onChange={(v) => updateReferenceId(i, "value", v)}
                  placeholder="ID value..."
                  onFocus={() => setActiveContext(r.context)}
                />
              </div>

              <div>
                <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                  Context in Document
                </label>
                <CleanInputField
                  value={r.context ?? ""}
                  onChange={(v) => updateReferenceId(i, "context", v)}
                  multiline
                  placeholder="Context snippet..."
                  onFocus={() => setActiveContext(r.context)}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addReferenceId}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 hover:border-white/20 py-2.5 text-xs text-gray-400 hover:text-gray-200 transition"
          >
            <Plus size={13} /> Add Reference ID
          </button>
        </div>
      </Section>

      {/* Sections */}
      <Section
        title="Document Sections"
        icon={FileText}
        color="blue"
        count={content?.sections?.length ?? 0}
        defaultOpen={false}
      >
        <div className="space-y-4">
          {(content?.sections ?? []).map((s, i) => (
            <div
              key={i}
              className="group relative rounded-xl border border-white/5 bg-[#07090e] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Section {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => deleteSection(i)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  title="Delete Section"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div>
                <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                  Section Title
                </label>
                <CleanInputField
                  value={s.title ?? ""}
                  onChange={(v) => updateSection(i, "title", v)}
                  placeholder="Section title..."
                  onFocus={() => setActiveContext(null)}
                />
              </div>

              <div>
                <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                  Content
                </label>
                <CleanInputField
                  value={s.content ?? ""}
                  onChange={(v) => updateSection(i, "content", v)}
                  multiline
                  placeholder="Section content..."
                  onFocus={() => setActiveContext(null)}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addSection}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 hover:border-white/20 py-2.5 text-xs text-gray-400 hover:text-gray-200 transition"
          >
            <Plus size={13} /> Add Section
          </button>
        </div>
      </Section>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function ExtractionVerificationPanel({
  documentId,
  fileName,
  extractedContent: initialContent,
  onConfirm,
  onConfirmed,
}) {
  const [content, setContent] = useState(initialContent ?? {});
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(true);
  const [activeContext, setActiveContext] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [isConfirmedLocal, setIsConfirmedLocal] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    setError(null);
    try {
      await onConfirm({ documentId, extractedContent: content });
      setIsConfirmedLocal(true);
      setIsOpen(false);
      onConfirmed?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to confirm extraction",
      );
    } finally {
      setConfirming(false);
    }
  };

  if (isConfirmedLocal) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col bg-[#07090e]/98 backdrop-blur-md font-sans"
        >
          {/* Topbar */}
          <div className="flex flex-col sm:flex-row shrink-0 items-start sm:items-center justify-between border-b border-white/5 bg-[#0d1017] px-4 sm:px-6 py-4 gap-4 sm:gap-0">
            <div className="flex items-start sm:items-center gap-3 w-full sm:w-auto">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <ShieldCheck size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">
                    Verify Extracted Content
                  </h2>
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[9px] font-bold text-amber-400 uppercase tracking-wide whitespace-nowrap">
                    Verification Sandbox
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 truncate w-full">
                  Compare raw document text with extracted parameters for{" "}
                  <span className="text-gray-200 font-semibold">
                    {fileName}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto justify-end sm:justify-start">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300"
                  >
                    <AlertTriangle size={12} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-white/10 active:scale-[0.98] transition-all"
              >
                <Minimize2 size={13} />
                Minimize
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirming ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                {confirming ? "Confirming..." : "Confirm & Start Analysis"}
              </button>
            </div>
          </div>

          {/* Split Screen Layout */}
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:divide-x divide-y lg:divide-y-0 divide-white/5 overflow-hidden">
            {/* Left Pane (Original Doc Preview) */}
            <div className="flex w-full lg:w-1/2 flex-col overflow-hidden bg-[#090b10] min-h-[35vh] lg:min-h-0">
              <DocumentPreviewPane
                extractedContent={content}
                fileName={fileName}
                activeContext={activeContext}
              />
            </div>

            {/* Right Pane (Rich Editor) */}
            <div className="flex w-full lg:w-1/2 flex-col overflow-hidden bg-[#07090e] flex-1">
              <div className="flex shrink-0 flex-wrap items-center justify-between border-b border-white/5 px-4 lg:px-6 py-3 bg-[#0d1017]/30 gap-2">
                <div className="flex items-center gap-2">
                  <Edit3 size={14} className="text-amber-400" />
                  <span className="text-xs font-semibold text-gray-200">
                    Extracted Schema Editor
                  </span>
                </div>
                <span className="text-[10px] text-gray-500">
                  Edits save instantly to local draft state
                </span>
              </div>
              <ExtractedContentEditor
                content={content}
                onChange={setContent}
                setActiveContext={setActiveContext}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const triggerCard = (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/5 to-amber-600/[0.02] p-5 shadow-[0_12px_40px_rgba(245,158,11,0.04)] mb-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <ShieldCheck size={22} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              Manual Verification Required
            </h3>
            <p className="mt-1 text-sm text-gray-400 leading-relaxed max-w-xl">
              OCR content extraction is complete. Review and confirm the
              extracted values (dates, contacts, amounts) before AI analysis
              begins.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 active:scale-[0.98] transition-all self-start sm:self-center shrink-0 shadow-lg shadow-amber-500/5"
        >
          <Edit3 size={15} />
          Review & Verify Content
        </button>
      </div>
    </motion.div>
  );

  const portalTarget =
    mounted && typeof document !== "undefined"
      ? document.getElementById("verification-panel-portal")
      : null;

  return (
    <>
      {!isOpen &&
        (portalTarget ? createPortal(triggerCard, portalTarget) : triggerCard)}

      {/* Portal Overlay */}
      {mounted && typeof window !== "undefined"
        ? createPortal(modalContent, document.body)
        : null}
    </>
  );
}
