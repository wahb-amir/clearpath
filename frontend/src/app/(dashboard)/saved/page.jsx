"use client";

import { motion } from "framer-motion";
import { FileText, Bookmark, Clock, ExternalLink } from "lucide-react";
import { mockHistoryItems } from "@/lib/mockUserData";

export default function SavedPage() {
  const savedItems = mockHistoryItems.filter((item) => item.saved);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-100 mb-2">Saved Items</h1>
        <p className="text-slate-400">Quickly access your pinned and favorite documents.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {savedItems.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800/50">
            <Bookmark size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-1">No saved items</h3>
            <p className="text-slate-500 text-sm">You haven't saved any documents yet.</p>
          </div>
        ) : (
          savedItems.map((item, index) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              key={item.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col transition-colors group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center">
                  <FileText size={20} className="text-blue-400" />
                </div>
                <Bookmark size={20} className="text-blue-400" fill="currentColor" />
              </div>
              
              <h3 className="text-lg font-semibold text-slate-200 mb-2 group-hover:text-blue-400 transition-colors line-clamp-1">
                {item.title}
              </h3>
              
              <p className="text-sm text-slate-400 mb-6 line-clamp-3 flex-1">
                {item.summary}
              </p>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-800/60 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Clock size={14}/> {new Date(item.date).toLocaleDateString()}</span>
                <span className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                  Open <ExternalLink size={14} />
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
