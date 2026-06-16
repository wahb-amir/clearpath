"use client";

import { useState } from "react";
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
} from "lucide-react";
import { mockHistoryItems } from "@/lib/mockUserData";

export default function HistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  const filteredItems = mockHistoryItems.filter((item) => {
    const matchesSearch = item.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const matchesType =
      filterType === "all" || item.urgency === filterType;

    return matchesSearch && matchesType;
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
            placeholder="Search documents by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Urgencies</option>
            <option value="high">High Urgency</option>
            <option value="medium">Medium Urgency</option>
            <option value="low">Low Urgency</option>
          </select>

          <button className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-200 hover:bg-slate-800 transition-colors">
            <Filter size={16} />
            <span className="hidden sm:inline">More Filters</span>
          </button>
        </div>
      </div>

      {/* LIST */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800/50">
            <FileText size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-1">
              No documents found
            </h3>
            <p className="text-slate-500 text-sm">
              Try adjusting your search or filters.
            </p>
          </div>
        ) : (
          filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
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
    </div>
  );
}