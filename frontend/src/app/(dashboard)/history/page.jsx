"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
export default function HistoryPage() {
  // Search state (handled client-side)
  const [searchQuery, setSearchQuery] = useState("");

  // API query param states
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // API response states
  const [items, setItems] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch data when page or status filter changes
  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          pageSize: pageSize.toString(),
          status: statusFilter,
        });

        const response = await apiFetch(`/analysis/history?${queryParams.toString()}`, {});
        
        if (!response.ok) {
          throw new Error("Failed to load document history.");
        }

        const data = await response.json();
        
        setItems(data.items || []);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [page, statusFilter, pageSize]);

  // Reset page to 1 when changing filters
  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  // Filter items locally matching the search query
  const filteredItems = (items || []).filter((item) => {
  const itemTitle = item?.title ?? '';
  const search = searchQuery ?? '';
  
  return itemTitle.toLowerCase().includes(search.toLowerCase());
});

  return (
    <div className="p-4 md:p-8">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-100 mb-2">
          Document History
        </h1>
        <p className="text-slate-400">
          View and manage all your previously analyzed documents.
        </p>
      </div>

      {/* SEARCH + FILTER */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            placeholder="Search fetched documents by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
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
        {isLoading ? (
          /* LOADING STATE */
          <div className="text-center py-24 bg-slate-900/30 rounded-2xl border border-slate-800/50 flex flex-col items-center justify-center gap-3">
            <Loader2 size={36} className="text-blue-500 animate-spin" />
            <p className="text-slate-400 text-sm">Loading history items...</p>
          </div>
        ) : error ? (
          /* ERROR STATE */
          <div className="text-center py-16 bg-rose-950/10 rounded-2xl border border-rose-900/30">
            <XCircle size={48} className="mx-auto text-rose-500 mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-1">
              Error Loading History
            </h3>
            <p className="text-rose-400/80 text-sm max-w-md mx-auto">{error}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          /* EMPTY STATE */
          <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800/50">
            <FileText size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-1">
              No documents found
            </h3>
            <p className="text-slate-500 text-sm">
              Try adjusting your search or status filters.
            </p>
          </div>
        ) : (
          /* LIST RENDERING */
          filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-colors group"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* LEFT SIDE */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-10 h-10 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center flex-shrink-0 mt-1">
                    <FileText size={20} className="text-blue-400" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-200 mb-1 group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-3">
                      <span className="flex items-center gap-1">
                        <FileText size={12} /> {item.type}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-700" />
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed max-w-2xl">
                      {item.summary}
                    </p>
                  </div>
                </div>

                {/* RIGHT SIDE */}
                <div className="flex md:flex-col items-center md:items-end justify-between gap-3 min-w-[140px]">
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
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <AlertTriangle size={12} /> Review
                      </span>
                    )}

                    {item.status === "failed" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle size={12} /> Failed
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
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

                    <button className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
                      <ExternalLink size={18} />
                    </button>

                    <button className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* PAGINATION CONTROLS */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-850">
          <p className="text-xs text-slate-500">
            Showing page <span className="text-slate-300 font-medium">{page}</span> of{" "}
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