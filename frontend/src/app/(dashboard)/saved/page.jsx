"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  Bookmark,
  Clock,
  ExternalLink,
  XCircle,
  Loader2,
} from "lucide-react";
import useSWR from "swr";
import { apiFetch } from "@/lib/auth/apiFetch";

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SavedItemSkeleton() {
  return (
    <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-full bg-slate-800/60" />
        <div className="w-5 h-5 rounded bg-slate-800/60" />
      </div>
      <div className="h-5 bg-slate-800/60 rounded-md w-3/4 mb-3" />
      <div className="space-y-2 flex-1 mb-6">
        <div className="h-3 bg-slate-800/40 rounded-md w-full" />
        <div className="h-3 bg-slate-800/40 rounded-md w-5/6" />
        <div className="h-3 bg-slate-800/40 rounded-md w-4/6" />
      </div>
      <div className="flex items-center justify-between border-t border-slate-800/60 pt-4">
        <div className="h-3 bg-slate-800/40 rounded-md w-20" />
        <div className="h-3 bg-slate-800/40 rounded-md w-12" />
      </div>
    </div>
  );
}

// ── Saved item card ────────────────────────────────────────────────────────────
function SavedItemCard({ item, index, onUnsave }) {
  const [unsaving, setUnsaving] = useState(false);

  const handleUnsave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setUnsaving(true);
    try {
      await onUnsave(item.documentId || item.id);
    } finally {
      setUnsaving(false);
    }
  };

  const displayName =
    item.document?.fileName ||
    item.title ||
    "Unnamed Document";

  const summary =
    item.summary || "No summary available for this document.";

  const date = item.updatedAt || item.createdAt;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.05 }}
      className="group"
    >
      <Link
        href={`/history/${item.documentId || item.id}`}
        className="block"
      >
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col h-full transition-colors cursor-pointer">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center flex-shrink-0">
              <FileText size={20} className="text-blue-400" />
            </div>

            <button
              onClick={handleUnsave}
              disabled={unsaving}
              title="Remove from saved"
              className="text-blue-400 hover:text-slate-400 transition-colors disabled:opacity-50"
            >
              {unsaving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Bookmark size={18} fill="currentColor" />
              )}
            </button>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-slate-200 mb-2 group-hover:text-blue-400 transition-colors line-clamp-1">
            {displayName}
          </h3>

          {/* Summary */}
          <p className="text-sm text-slate-400 mb-6 line-clamp-3 flex-1 leading-relaxed">
            {summary}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-800/60 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {date ? new Date(date).toLocaleDateString() : "Unknown date"}
            </span>
            <span className="flex items-center gap-1.5 group-hover:text-blue-400 transition-colors">
              Open <ExternalLink size={14} />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SavedPage() {
  const { data, error, isLoading, mutate } = useSWR(
    "/analysis/saved",
    async (url) => {
      const response = await apiFetch(url);
      if (!response.ok) throw new Error("Failed to load saved documents.");
      return response.json();
    },
    { revalidateOnFocus: true }
  );

  const items = data?.items || [];
  const showSkeleton = isLoading && !data;
  const showError = error && !data;

  const handleUnsave = async (docId) => {
    // Optimistic update: remove from local list instantly
    mutate(
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.filter(
            (i) => (i.documentId || i.id) !== docId
          ),
        };
      },
      { revalidate: false }
    );

    try {
      await apiFetch(`/analysis/documents/${docId}/toggle-save`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Failed to unsave document:", err);
      mutate(); // revert on failure
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-100 mb-2">
          Saved Items
        </h1>
        <p className="text-slate-400">
          Quickly access your pinned and favorite documents.
        </p>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {showSkeleton ? (
          <>
            <SavedItemSkeleton />
            <SavedItemSkeleton />
            <SavedItemSkeleton />
          </>
        ) : showError ? (
          <div className="col-span-full text-center py-16 bg-rose-950/10 rounded-2xl border border-rose-900/30">
            <XCircle size={48} className="mx-auto text-rose-500 mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-1">
              Error Loading Saved Items
            </h3>
            <p className="text-rose-400/80 text-sm max-w-md mx-auto">
              {error?.message || "An unexpected error occurred."}
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800/50">
            <Bookmark size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-1">
              No saved items
            </h3>
            <p className="text-slate-500 text-sm">
              Bookmark documents from the History page to find them here.
            </p>
          </div>
        ) : (
          items.map((item, index) => (
            <SavedItemCard
              key={item.documentId || item.id}
              item={item}
              index={index}
              onUnsave={handleUnsave}
            />
          ))
        )}
      </div>
    </div>
  );
}
