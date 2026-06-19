"use client";

import { useState } from "react";
import {
  HelpCircle,
  Search,
  FileText,
  User,
  CreditCard,
  ShieldCheck,
  Settings,
  Rocket,
  Mail,
  MessageCircle,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { X } from "lucide-react";

const categories = [
  { icon: FileText, label: "Document Analysis", count: 12 },
  { icon: User, label: "Account & Profile", count: 8 },
  { icon: CreditCard, label: "Billing & Plans", count: 10 },
  { icon: ShieldCheck, label: "Privacy & Security", count: 6 },
  { icon: Settings, label: "Settings", count: 5 },
  { icon: Rocket, label: "Getting Started", count: 7 },
];

const faqs = [
  {
    q: "How do I upload a document for analysis?",
    a: "Navigate to the Analyze Document section from the sidebar. Click the upload area or drag and drop your file — we support PDF, DOCX, and TXT formats up to 25MB. Once uploaded, the analysis begins automatically.",
  },
  {
    q: "What file formats are supported?",
    a: "ClearPath currently supports PDF, DOCX, DOC, and plain TXT files. Support for XLSX and image-based documents (via OCR) is on our roadmap and coming soon.",
  },
  {
    q: "How do I save an analysis for later?",
    a: "After any analysis completes, click the bookmark icon in the top-right of the results panel. Saved items are accessible anytime from the Saved Items section in the sidebar.",
  },
  {
    q: "Can I cancel my subscription at any time?",
    a: "Yes. Go to Settings → Billing and click Cancel Plan. Your access continues until the end of your current billing period — no hidden fees, no friction.",
  },
  {
    q: "Is my data stored after analysis?",
    a: "Documents you upload are processed securely and not used to train any models. Files are retained for 30 days to support your history view, after which they are automatically purged from our servers.",
  },
];

const contactCards = [
  {
    icon: Mail,
    title: "Email support",
    desc: "Our team replies within 24 hours on business days.",
    cta: "Send a message",
  },
  {
    icon: MessageCircle,
    title: "Live chat",
    desc: "Available Mon–Fri, 9am–6pm UTC for Pro users.",
    cta: "Start a chat",
  },
  {
    icon: X,
    title: "Twitter / X",
    desc: "DM us @ClearPathHQ for quick questions.",
    cta: "Go to profile",
  },
];

export default function HelpCenter() {
  const [openFaq, setOpenFaq] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = faqs.filter((f) =>
    f.q.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-16">
      <div className="px-10 pt-12 pb-10 border-b border-slate-800">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/25 rounded-full px-3 py-1 mb-5 uppercase tracking-wider">
          <HelpCircle size={12} /> Help Center
        </div>
        <h1 className="text-3xl font-semibold text-slate-100 mb-2">
          How can we help you?
        </h1>
        <p className="text-slate-500 text-sm max-w-lg leading-relaxed">
          Browse articles, FAQs, and guides — or reach out directly to our
          support team.
        </p>
        <div className="relative mt-6 max-w-lg">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for answers..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div className="px-10 pt-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-xs text-emerald-300">
            All systems are{" "}
            <span className="text-emerald-400 font-medium">operational</span> —
            avg. response time is under 2 hours.
          </p>
        </div>

        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 mt-8">
          Browse by topic
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mb-10">
          {categories.map(({ icon: Icon, label, count }, i) => (
            <div
              key={i}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer hover:border-blue-500 hover:bg-slate-900/80 hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-2"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Icon size={18} />
              </div>
              <p className="text-sm font-medium text-slate-300">{label}</p>
              <p className="text-xs text-slate-500">{count} articles</p>
            </div>
          ))}
        </div>

        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
          Frequently asked questions
        </p>
        <div className="mb-10 border-t border-slate-800">
          {filtered.map((item, i) => (
            <div key={i} className="border-b border-slate-800">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between py-4 text-left text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors gap-3"
              >
                {item.q}
                <ChevronDown
                  size={16}
                  className={`text-slate-500 flex-shrink-0 transition-transform duration-250 ${openFaq === i ? "rotate-180 text-blue-400" : ""}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 text-sm text-slate-500 leading-relaxed ${openFaq === i ? "max-h-48 pb-4" : "max-h-0"}`}
              >
                {item.a}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
          Still need help?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {contactCards.map(({ icon: Icon, title, desc, cta }, i) => (
            <div
              key={i}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-2 hover:border-slate-700 hover:bg-slate-900/60 transition-all cursor-pointer"
            >
              <Icon size={22} className="text-blue-400" />
              <p className="text-sm font-medium text-slate-300">{title}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              <p className="text-xs text-blue-400 flex items-center gap-1 mt-1">
                {cta} <ArrowRight size={12} />
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
