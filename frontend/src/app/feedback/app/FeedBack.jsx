"use client";

import { useState } from "react";
import { MessageSquare, ThumbsUp, ThumbsDown, Bug, Lightbulb, Star, Send, CheckCircle } from "lucide-react";

const categories = [
  { label: "General feedback", icon: MessageSquare, value: "general" },
  { label: "Bug report", icon: Bug, value: "bug" },
  { label: "Feature request", icon: Lightbulb, value: "feature" },
  { label: "Rate your experience", icon: Star, value: "rating" },
];

const experienceOptions = [
  { label: "Loved it", icon: ThumbsUp, value: "positive", color: "emerald" },
  { label: "Needs work", icon: ThumbsDown, value: "negative", color: "red" },
];

const colorMap = {
  emerald: {
    bg: "#052e16",
    text: "#4ade80",
    border: "#166534",
    activeBg: "#14532d",
    activeBorder: "#16a34a",
  },
  red: {
    bg: "#1c0a0a",
    text: "#f87171",
    border: "#7f1d1d",
    activeBg: "#450a0a",
    activeBorder: "#dc2626",
  },
  blue: {
    bg: "#0c1a2e",
    text: "#60a5fa",
    border: "#1e3a5f",
    activeBg: "#1e3a5f",
    activeBorder: "#3b82f6",
  },
};

const starLabels = ["Poor", "Fair", "Good", "Great", "Excellent"];

export default function FeedBack() {
  const [category, setCategory] = useState("general");
  const [experience, setExperience] = useState(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) return;
    setSubmitted(true);
  };

  const handleReset = () => {
    setCategory("general");
    setExperience(null);
    setRating(0);
    setHoverRating(0);
    setMessage("");
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-3">Thanks for sharing</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Your feedback goes directly to the team. We read every submission and use it to make ClearPath better.
          </p>
          <button
            onClick={handleReset}
            className="px-5 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            Submit another response
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10 max-w-4xl mx-auto">

      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <MessageSquare size={20} className="text-blue-400" />
          </div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Feedback</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-100 mb-3 leading-tight">
          Tell us what you think
        </h1>
        <p className="text-slate-400 text-base leading-relaxed max-w-2xl">
          Every piece of feedback is read by the team. Whether it is a bug, an idea, or just how you are feeling about ClearPath — we want to hear it.
        </p>
      </div>

      <div className="mb-8">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">What kind of feedback is this?</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = category === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`flex flex-col items-center gap-2.5 px-4 py-4 rounded-xl border text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600/10 border-blue-500/40 text-blue-400"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <Icon size={20} className={isActive ? "text-blue-400" : "text-slate-500"} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">How has your experience been?</p>
        <div className="flex gap-3">
          {experienceOptions.map((opt) => {
            const Icon = opt.icon;
            const isActive = experience === opt.value;
            const c = colorMap[opt.color];
            return (
              <button
                key={opt.value}
                onClick={() => setExperience(opt.value)}
                className="flex items-center gap-2.5 px-5 py-3 rounded-xl border text-sm font-medium transition-colors"
                style={{
                  background: isActive ? c.activeBg : "#0f172a",
                  borderColor: isActive ? c.activeBorder : "#1e293b",
                  color: isActive ? c.text : "#94a3b8",
                }}
              >
                <Icon size={17} style={{ color: isActive ? c.text : "#64748b" }} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Rate your overall experience</p>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= (hoverRating || rating);
            return (
              <button
                key={star}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  size={28}
                  className="transition-colors"
                  fill={filled ? "#f59e0b" : "transparent"}
                  stroke={filled ? "#f59e0b" : "#475569"}
                />
              </button>
            );
          })}
          {(hoverRating || rating) > 0 && (
            <span className="ml-3 text-sm text-slate-400">
              {starLabels[(hoverRating || rating) - 1]}
            </span>
          )}
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your message</p>
          <span className="text-xs text-slate-600">{message.length} / 1000</span>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
          rows={6}
          placeholder={
            category === "bug"
              ? "Describe what happened, what you expected, and any steps to reproduce it..."
              : category === "feature"
              ? "Describe the feature you have in mind and the problem it would solve..."
              : category === "rating"
              ? "Share anything specific that shaped your experience..."
              : "Share your thoughts — anything is welcome..."
          }
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 resize-none transition-colors leading-relaxed"
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 mb-8">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Submission summary</p>
        <div className="space-y-2.5">
          {[
            { label: "Category", value: categories.find((c) => c.value === category)?.label },
            { label: "Experience", value: experience ? experienceOptions.find((o) => o.value === experience)?.label : "Not selected" },
            { label: "Rating", value: rating > 0 ? `${starLabels[rating - 1]} (${rating}/5)` : "Not rated" },
            { label: "Message length", value: message.trim() ? `${message.trim().split(/\s+/).length} words` : "Empty" },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{row.label}</span>
              <span className={`font-medium ${row.value === "Not selected" || row.value === "Not rated" || row.value === "Empty" ? "text-slate-600" : "text-slate-300"}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSubmit}
          disabled={!message.trim()}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            message.trim()
              ? "bg-blue-600 hover:bg-blue-500 text-white"
              : "bg-slate-800 text-slate-600 cursor-not-allowed"
          }`}
        >
          <Send size={15} />
          Send feedback
        </button>
        <p className="text-xs text-slate-600">Your feedback is anonymous unless you include personal details in your message.</p>
      </div>

    </div>
  );
}