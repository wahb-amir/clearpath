"use client";

import { useState } from "react";
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
import { userProfile } from "@/lib/mockUserData";

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-display font-bold text-slate-100">
          Your Profile
        </h1>
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
                  {userProfile.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>

                <div>
                  <h2 className="text-2xl font-semibold text-slate-100">
                    {userProfile.name}
                  </h2>
                  <p className="font-medium text-blue-400">
                    {userProfile.role}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
              >
                <Edit size={16} />
                {isEditing ? "Cancel" : "Edit Profile"}
              </button>
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
                      defaultValue={userProfile.email}
                      className="w-full rounded border border-slate-700 bg-slate-800 p-1 text-sm"
                    />
                  ) : (
                    userProfile.email
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Member Since
                </label>
                <div className="flex items-center gap-2 text-slate-300">
                  <User size={16} className="text-slate-400" />
                  {userProfile.joinedDate}
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
                      defaultValue={userProfile.preferredLanguage}
                      className="w-full rounded border border-slate-700 bg-slate-800 p-1 text-sm"
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="Vietnamese">Vietnamese</option>
                    </select>
                  ) : (
                    userProfile.preferredLanguage
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Notification Preference
                </label>
                <div className="flex items-center gap-2 text-slate-300">
                  <Bell size={16} className="text-slate-400" />
                  Email &amp; Push
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="mt-6 flex justify-end">
                <button
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
                <button className="text-sm font-medium text-blue-400 hover:text-blue-300">
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
                <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700">
                  Enable
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          {/* Stats / How ClearPath Helps */}
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
                <span className="text-xl font-bold text-slate-100">12</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="rounded-lg bg-blue-900/30 p-2 text-blue-400">
                    <Bell size={18} />
                  </div>
                  <span>Deadlines Tracked</span>
                </div>
                <span className="text-xl font-bold text-slate-100">5</span>
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
            <button className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700">
              Contact Support
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}