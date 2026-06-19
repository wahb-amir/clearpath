"use client";

import {
  ShieldCheck,
  Lock,
  Eye,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  Server,
  KeyRound,
  RefreshCw,
  Users,
} from "lucide-react";

const trustPillars = [
  {
    icon: Lock,
    title: "End-to-end encryption",
    description:
      "Every document you upload is encrypted in transit and at rest using AES-256. Your files are never readable by anyone except you.",
    badge: "Active",
    badgeColor: "emerald",
  },
  {
    icon: Eye,
    title: "Zero data retention",
    description:
      "We never store your document content after analysis is complete. Once results are returned, your file is permanently deleted from our servers.",
    badge: "Enforced",
    badgeColor: "blue",
  },
  {
    icon: FileCheck,
    title: "Secure file processing",
    description:
      "Uploaded PDFs, DOCX, and TXT files are processed in isolated sandboxes. No file ever touches shared infrastructure or other user sessions.",
    badge: "Isolated",
    badgeColor: "violet",
  },
  {
    icon: Server,
    title: "SOC 2 compliant infrastructure",
    description:
      "Our processing infrastructure is hosted on SOC 2 Type II certified cloud providers with continuous monitoring and threat detection.",
    badge: "Certified",
    badgeColor: "emerald",
  },
  {
    icon: KeyRound,
    title: "Access control",
    description:
      "Your history, saved items, and profile data are scoped strictly to your account. No team member or support agent can access your documents without your explicit consent.",
    badge: "Enforced",
    badgeColor: "blue",
  },
  {
    icon: RefreshCw,
    title: "Regular security audits",
    description:
      "We commission independent penetration tests and vulnerability assessments every quarter. Results inform our security roadmap and patching schedule.",
    badge: "Quarterly",
    badgeColor: "amber",
  },
];

const faqItems = [
  {
    q: "Can ClearPath employees read my documents?",
    a: "No. Documents are processed in isolated sandboxes and never stored after analysis. Employees have no access to your file contents at any stage.",
  },
  {
    q: "What file types are accepted and how are they handled?",
    a: "We accept PDF, DOCX, and TXT files. Each upload is scanned for malware, processed in a sandboxed environment, and permanently deleted once results are returned to you.",
  },
  {
    q: "Is my data used to train AI models?",
    a: "Never. Your documents are used solely to generate your analysis. We do not use any uploaded content for model training, improvement, or any other secondary purpose.",
  },
  {
    q: "How do I permanently delete my account and history?",
    a: "You can delete your account and all associated data from the Settings page. Deletion is immediate and irreversible — all records, history, and saved items are purged.",
  },
];

const badgeStyles = {
  emerald: { bg: "#052e16", text: "#4ade80", border: "#166534" },
  blue: { bg: "#0c1a2e", text: "#60a5fa", border: "#1e3a5f" },
  violet: { bg: "#1a0f2e", text: "#a78bfa", border: "#3b1d6e" },
  amber: { bg: "#1c1000", text: "#fbbf24", border: "#78350f" },
};

export default function SafetyTrust() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10 max-w-4xl mx-auto">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <ShieldCheck size={20} className="text-blue-400" />
          </div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Safety & Trust
          </span>
        </div>
        <h1 className="text-3xl font-bold text-slate-100 mb-3 leading-tight">
          Your documents stay yours
        </h1>
        <p className="text-slate-400 text-base leading-relaxed max-w-2xl">
          ClearPath is built on a simple principle: we process your files to
          help you, then get out of the way. Here is exactly how we protect your
          data at every step.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        {trustPillars.map((pillar, idx) => {
          const Icon = pillar.icon;
          const badge = badgeStyles[pillar.badgeColor];
          return (
            <div
              key={idx}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col gap-3 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-blue-400" />
                  </div>
                  <p className="font-semibold text-slate-100 text-sm leading-snug">
                    {pillar.title}
                  </p>
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 border"
                  style={{
                    background: badge.bg,
                    color: badge.text,
                    borderColor: badge.border,
                  }}
                >
                  {pillar.badge}
                </span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                {pillar.description}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 mb-12">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={16} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            What we never do
          </h2>
        </div>
        <p className="text-slate-500 text-xs mb-5">
          These are unconditional, not subject to change by plan or upgrade.
        </p>
        <ul className="space-y-3">
          {[
            "Sell or share your document content with third parties",
            "Use uploaded files to train or improve AI models",
            "Store your documents after analysis is delivered",
            "Allow any employee to read your files without a court order",
            "Run ads targeted at your document content",
          ].map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-sm text-slate-300"
            >
              <CheckCircle
                size={16}
                className="text-emerald-500 mt-0.5 flex-shrink-0"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-12">
        <h2 className="text-lg font-semibold text-slate-100 mb-1">
          Common questions
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          Straight answers, no marketing language.
        </p>
        <div className="space-y-3">
          {faqItems.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="font-semibold text-slate-100 text-sm mb-2">
                {item.q}
              </p>
              <p className="text-slate-400 text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-blue-500/20 bg-blue-600/5 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} className="text-blue-400" />
            <p className="text-sm font-semibold text-slate-200">
              Still have questions?
            </p>
          </div>
          <p className="text-slate-400 text-sm">
            Our team responds to security and privacy questions within one
            business day.
          </p>
        </div>
        <a
          href="/help-center"
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          Contact support
        </a>
      </div>
    </div>
  );
}
