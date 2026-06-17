"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Globe,
  Bell,
  Type,
  ShieldAlert,
  LogOut,
} from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    emailAlerts: true,
    weeklyDigest: false,
    highContrast: false,
    largeText: false,
  });

  // 1. On mount: Load saved largeText setting from localStorage
  useEffect(() => {
    const savedLargeText = localStorage.getItem("clearpath-large-text");
    if (savedLargeText === "true") {
      setSettings((prev) => ({ ...prev, largeText: true }));
      document.documentElement.setAttribute("data-large-text", "true");
    }
  }, []);

  // 2. Custom toggle logic to handle the state, localStorage, and DOM attribute
  const toggleSetting = (key) => {
    setSettings((prev) => {
      const updatedValue = !prev[key];
      
      if (key === "largeText") {
        if (updatedValue) {
          document.documentElement.setAttribute("data-large-text", "true");
          localStorage.setItem("clearpath-large-text", "true");
        } else {
          document.documentElement.removeAttribute("data-large-text");
          localStorage.setItem("clearpath-large-text", "false");
        }
      }

      return { ...prev, [key]: updatedValue };
    });
  };

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-100">
          Settings
        </h1>
        <p className="text-slate-400">
          Customize your ClearPath experience.
        </p>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
        >
          <div className="border-b border-slate-800 bg-slate-950/30 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-200">
              Appearance & Accessibility
            </h2>
          </div>

          <div className="space-y-6 p-6">
            {/* Large Text */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-800 p-2 text-slate-400">
                  <Type size={20} />
                </div>
                <div>
                  <div className="font-medium text-slate-200">Large Text</div>
                  <div className="text-sm text-slate-400">
                    Increase the size of text across the app.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleSetting("largeText")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.largeText ? "bg-blue-600" : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.largeText ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </motion.section>

        {/* Notifications */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
        >
          <div className="border-b border-slate-800 bg-slate-950/30 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-200">
              Notifications
            </h2>
          </div>

          <div className="space-y-6 p-6">
            {/* Email Alerts */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-800 p-2 text-slate-400">
                  <Bell size={20} />
                </div>
                <div>
                  <div className="font-medium text-slate-200">
                    Email Alerts
                  </div>
                  <div className="text-sm text-slate-400">
                    Get notified about deadlines.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleSetting("emailAlerts")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.emailAlerts ? "bg-blue-600" : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.emailAlerts ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Weekly Digest */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-800 p-2 text-slate-400">
                  <Globe size={20} />
                </div>
                <div>
                  <div className="font-medium text-slate-200">
                    Weekly Digest
                  </div>
                  <div className="text-sm text-slate-400">
                    Weekly summary of your activity.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleSetting("weeklyDigest")}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.weeklyDigest ? "bg-blue-600" : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.weeklyDigest ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </motion.section>

        {/* Safety */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="overflow-hidden rounded-2xl border border-rose-900/50 bg-slate-900"
        >
          <div className="border-b border-slate-800 bg-slate-950/30 px-6 py-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-rose-500">
              <ShieldAlert size={20} />
              Safety & Trust
            </h2>
          </div>

          <div className="space-y-4 p-6">
            <p className="text-sm text-slate-400">
              ClearPath provides explanations but not legal or medical advice.
            </p>

            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <span className="font-medium text-slate-200">
                Sign out of all devices
              </span>
              <button type="button" className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700">
                <LogOut size={16} /> Log Out
              </button>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}