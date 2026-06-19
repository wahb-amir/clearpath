"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Search,
  Filter,
  MoreHorizontal,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Bookmark,
  Loader2,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/auth/apiFetch";
import useSWR from "swr";

function HistoryItemSkeleton() {
  return (
    <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* LEFT SIDE */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-slate-800/60 flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0 space-y-3">
            <div className="h-5 bg-slate-800/60 rounded-md w-3/4 md:w-1/2" />
            <div className="flex items-center gap-3">
              <div className="h-4 bg-slate-800/40 rounded-md w-16" />
              <div className="w-1 h-1 rounded-full bg-slate-800/40" />
              <div className="h-4 bg-slate-800/40 rounded-md w-24" />
            </div>
            <div className="space-y-2 pt-1">
              <div className="h-3 bg-slate-800/40 rounded-md w-full" />
              <div className="h-3 bg-slate-800/40 rounded-md w-5/6" />
            </div>
          </div>
        </div>
        {/* RIGHT SIDE */}
        <div className="flex md:flex-col items-center md:items-end justify-between gap-3 min-w-[140px] border-t md:border-t-0 border-slate-800/40 pt-3 md:pt-0">
          <div className="h-6 bg-slate-800/60 rounded-md w-16" />
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-800/40" />
            <div className="w-8 h-8 rounded-lg bg-slate-800/40" />
            <div className="w-8 h-8 rounded-lg bg-slate-800/40" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  // Search state (handled client-side)
  const [searchQuery, setSearchQuery] = useState("");

  // API query param states
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // SWR for history data
  const queryParams = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    status: statusFilter,
  });

  const { data, error, isLoading } = useSWR(
    `/analysis/history?${queryParams.toString()}`,
    async (url) => {
      const response = await apiFetch(url);
      if (!response.ok) {
        throw new Error("Failed to load document history.");
      }
      return response.json();
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: true,
    }
  );

  const items = data?.items || [];
  const totalPages = data?.totalPages || 1;

  // Reset page to 1 when changing filters
  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  // Filter items locally matching the search query
  const filteredItems = (items || []).filter((item) => {
    const itemTitle = item?.title || item?.document?.fileName || "";
    const search = searchQuery ?? "";
    return itemTitle.toLowerCase().includes(search.toLowerCase());
  });

  // Decide if we show skeleton loading: only if there's no data and we are currently loading
  const showSkeleton = isLoading && !data;
  const showError = error && !data;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="mb-8 border-b border-slate-800/60 pb-6">
        <h1 className="text-3xl font-display font-bold text-slate-100 mb-2 tracking-tight">
          Document Analysis History
        </h1>
        <p className="text-slate-400 text-sm">
          Monitor, view details, and manage your live-running and historical
          engine pipelines.
        </p>
      </div>

      {/* SEARCH + FILTER */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            placeholder="Search documents by filename or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="running">In Progress (Running)</option>
            <option value="completed">Completed</option>
            <option value="review_required">Review Required</option>
            <option value="failed">Failed</option>
          </select>

          <button className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-200 hover:bg-slate-800 transition-colors">
            <Filter size={16} />
            <span className="hidden sm:inline">More Filters</span>
          </button>
        </div>
      </div>

      {/* DYNAMIC CONTENT CONTAINER */}
      <div className="space-y-4">
        {showSkeleton ? (
          /* LOADING STATE: Show 3 skeleton items */
          <div className="space-y-4">
            <HistoryItemSkeleton />
            <HistoryItemSkeleton />
            <HistoryItemSkeleton />
          </div>
        ) : showError ? (
          /* ERROR STATE */
          <div className="text-center py-16 bg-rose-950/10 rounded-2xl border border-rose-900/30">
            <XCircle size={48} className="mx-auto text-rose-500 mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-1">
              Error Loading History
            </h3>
            <p className="text-rose-400/80 text-sm max-w-md mx-auto">{error.message || "An error occurred."}</p>
          </div>
        ) : filteredItems.length === 0 ? (

          /* EMPTY STATE */
          <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800/50">
            <FileText size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-1">
              No documents found
            </h3>
            <p className="text-slate-500 text-sm">
              Try adjusting your search query or status filters.
            </p>
          </div>
        ) : (
          /* LIST RENDERING */
          filteredItems.map((item, index) => (
            <Link
              key={item.id}
              href={`/history/${item.documentId || item.id}`}
              className="block group"
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="bg-slate-900 border border-slate-800 group-hover:border-slate-700 rounded-2xl p-5 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* LEFT SIDE */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 mt-1 ${
                        item.status === "running"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse"
                          : "bg-blue-900/30 border-blue-800/50 text-blue-400"
                      }`}
                    >
                      {item.status === "running" ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <FileText size={20} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-slate-200 mb-1 group-hover:text-blue-400 transition-colors truncate">
                        {item.title ||
                          item.document?.fileName ||
                          "Unnamed Document"}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-2">
                        <span className="flex items-center gap-1">
                          <FileText size={12} />{" "}
                          {item.type ||
                            item.document?.mimeType
                              ?.split("/")[1]
                              ?.toUpperCase() ||
                            "DOCUMENT"}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(
                            item.date || item.createdAt,
                          ).toLocaleDateString()}
                        </span>
                      </div>

                      {/* CONDITIONAL SKELETON LOADING BAR IF JOB IS ACTIVE */}
                      {item.status === "running" ? (
                        <div className="mt-3 max-w-md bg-slate-950/60 p-3 rounded-xl border border-slate-800/40">
                          <div className="flex justify-between items-center text-[11px] font-mono mb-1.5">
                            <span className="text-amber-400 font-bold">
                              STAGE: {item.currentStage || "QUEUED"}
                            </span>
                            <span className="text-slate-400 animate-pulse">
                              {item.docAnalysisStatus?.toLowerCase()}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full"
                              animate={{ x: ["-100%", "100%"] }}
                              transition={{
                                repeat: Infinity,
                                duration: 1.8,
                                ease: "linear",
                              }}
                              style={{ width: "40%" }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed max-w-2xl">
                          {item.summary ||
                            "No executive summary parsed for this pipeline container entry."}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* RIGHT SIDE */}
                  <div className="flex md:flex-col items-center md:items-end justify-between gap-3 min-w-[140px] border-t md:border-t-0 border-slate-800/40 pt-3 md:pt-0">
                    <div className="flex gap-2 flex-wrap">
                      {item.urgency === "high" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <AlertTriangle size={12} /> High
                        </span>
                      )}

                      {item.urgency === "medium" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Medium
                        </span>
                      )}

                      {item.status === "completed" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle size={12} /> Done
                        </span>
                      )}

                      {item.status === "review_required" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <AlertTriangle size={12} /> Review
                        </span>
                      )}

                      {item.status === "failed" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle size={12} /> Failed
                        </span>
                      )}

                      {item.status === "running" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                          <Loader2 size={12} className="animate-spin" /> In
                          Flight
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          // Handle bookmark logic
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          item.saved
                            ? "text-blue-400 bg-blue-900/20"
                            : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <Bookmark
                          size={18}
                          fill={item.saved ? "currentColor" : "none"}
                        />
                      </button>

                      <div className="p-2 rounded-lg text-slate-500 group-hover:text-slate-300 group-hover:bg-slate-800 transition-colors">
                        <ExternalLink size={18} />
                      </div>

                      <button
                        onClick={(e) => e.preventDefault()}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))
        )}
      </div>

      {/* PAGINATION CONTROLS */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-850">
          <p className="text-xs text-slate-500">
            Showing page{" "}
            <span className="text-slate-300 font-medium">{page}</span> of{" "}
            <span className="text-slate-300 font-medium">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center justify-center p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:hover:text-slate-400 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center justify-center p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:hover:text-slate-400 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
