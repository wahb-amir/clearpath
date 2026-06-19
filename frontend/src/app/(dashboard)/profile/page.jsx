"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Shield,
  Globe,
  Bell,
  FileText,
  Sparkles,
  HelpCircle,
  Edit,
} from "lucide-react";
import { apiFetch } from "@/lib/auth/apiFetch";

const API_BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(
  /\/$/,
  "",
);

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const targetUrl = API_BASE_URL
          ? `${API_BASE_URL}/auth/me`
          : "http://localhost:3001/auth/me";
        const response = await apiFetch(targetUrl, {});

        if (!response.ok) {
          throw new Error(`Server returned status code: ${response.status}`);
        }

        const payload = await response.json();

        // Defensive Check: Handle both nested response layouts safely
        const userData = payload?.user || payload;
        setUser(userData);
      } catch (err) {
        console.error("🚨 Catch Block Caught Local Exception:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to parse system response.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  // Loading/Skeleton state
  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-8 animate-pulse">
        <div className="mb-8">
          <div className="h-9 w-48 rounded bg-slate-800 mb-2" />
          <div className="h-4 w-80 rounded bg-slate-800" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-8 h-80" />
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 h-48" />
        </div>
      </div>
    );
  }

  // Error fallback interface
  if (error || !user) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-8 text-center mt-12">
        <p className="text-rose-400 font-medium">
          Could not load profile data.
        </p>
        <p className="text-sm text-slate-500 mt-2">
          {error || "Reason: Empty data layout."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
        >
          Retry Request
        </button>
      </div>
    );
  }

  // Safe variables mapping with strict fallbacks
  const displayName = user?.full_name || user?.name || "ClearPath User";
  const userEmail = user?.email || "No email available";
  const userRole = user?.role || "Member";
  const preferredLang = user?.preferredLanguage || "English";
  const notificationPref = user?.notificationPreference || "Email Alerts";
  const docsCount = user?.documentsAnalyzedCount || 0;
  const deadlinesCount = user?.deadlinesTrackedCount || 0;

  // Format ISO timestamps into readable strings safely
  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : user?.joinedDate || "Recent";

  // Generate dynamic initials safely from space-split names
  const userInitials =
    displayName
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-100">Your Profile</h1>
        <p className="text-slate-400">
          Manage your personal information and ClearPath preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Profile Header Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8"
          >
            <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-blue-800 bg-blue-900 text-2xl font-bold text-blue-200 shadow-xl shadow-blue-900/20">
                  {userInitials}
                </div>

                <div>
                  <h2 className="text-2xl font-semibold text-slate-100">
                    {displayName}
                  </h2>
                  <p className="font-medium text-blue-400">{userRole}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 border-t border-slate-800/60 pt-6 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Email Address
                </label>
                <div className="flex items-center gap-2 text-slate-300">
                  <Mail size={16} className="text-slate-400" />
                  {isEditing ? (
                    <input
                      type="email"
                      defaultValue={userEmail}
                      className="w-full rounded border border-slate-700 bg-slate-800 p-1 text-sm outline-none text-slate-200 focus:border-blue-500"
                    />
                  ) : (
                    userEmail
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Member Since
                </label>
                <div className="flex items-center gap-2 text-slate-300">
                  <User size={16} className="text-slate-400" />
                  {joinedDate}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Preferred Language
                </label>
                <div className="flex items-center gap-2 text-slate-300">
                  <Globe size={16} className="text-slate-400" />
                  {isEditing ? (
                    <select
                      defaultValue={preferredLang}
                      className="w-full rounded border border-slate-700 bg-slate-800 p-1 text-sm outline-none text-slate-200 focus:border-blue-500"
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="Vietnamese">Vietnamese</option>
                    </select>
                  ) : (
                    preferredLang
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Notification Preference
                </label>
                <div className="flex items-center gap-2 text-slate-300">
                  <Bell size={16} className="text-slate-400" />
                  {notificationPref}
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  onClick={() => setIsEditing(false)}
                >
                  Save Changes
                </button>
              </div>
            )}
          </motion.div>

          {/* Account Settings / Privacy */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
          >
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-200">
              <Shield size={20} className="text-blue-400" />
              Privacy &amp; Security
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-slate-800/50 bg-slate-950/50 p-4">
                <div>
                  <h4 className="font-medium text-slate-200">
                    Data Deletion Policy
                  </h4>
                  <p className="text-sm text-slate-400">
                    ClearPath automatically deletes un-saved documents after 30
                    days.
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm font-medium text-blue-400 hover:text-blue-300"
                >
                  Manage
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-800/50 bg-slate-950/50 p-4">
                <div>
                  <h4 className="font-medium text-slate-200">
                    Two-Factor Authentication
                  </h4>
                  <p className="text-sm text-slate-400">
                    Add an extra layer of security to your account.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
                >
                  Enable
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-blue-800/30 bg-gradient-to-b from-blue-900/40 to-slate-900 p-6"
          >
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
              <Sparkles size={20} className="text-blue-400" />
              Your Activity
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="rounded-lg bg-blue-900/30 p-2 text-blue-400">
                    <FileText size={18} />
                  </div>
                  <span>Documents Analyzed</span>
                </div>
                <span className="text-xl font-bold text-slate-100">
                  {docsCount}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="rounded-lg bg-blue-900/30 p-2 text-blue-400">
                    <Bell size={18} />
                  </div>
                  <span>Deadlines Tracked</span>
                </div>
                <span className="text-xl font-bold text-slate-100">
                  {deadlinesCount}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
          >
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-200">
              <HelpCircle size={20} className="text-slate-400" />
              Need Support?
            </h3>
            <p className="mb-4 text-sm text-slate-400">
              Having trouble with an analysis or need help navigating ClearPath?
            </p>
            <button
              type="button"
              className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700"
            >
              Contact Support
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
