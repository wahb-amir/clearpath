"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Shield, Globe, Bell, FileText, Sparkles, HelpCircle, Edit } from "lucide-react";
import { userProfile } from "@/lib/mockUserData";

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-100 mb-2">Your Profile</h1>
        <p className="text-slate-400">Manage your personal information and ClearPath preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Header Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-blue-900 border-2 border-blue-800 flex items-center justify-center text-2xl font-bold text-blue-200 shadow-xl shadow-blue-900/20">
                  {userProfile.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-slate-100">{userProfile.name}</h2>
                  <p className="text-blue-400 font-medium">{userProfile.role}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <Edit size={16} />
                {isEditing ? "Cancel" : "Edit Profile"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-800/60">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Email Address</label>
                <div className="flex items-center gap-2 text-slate-300">
                  <Mail size={16} className="text-slate-400" />
                  {isEditing ? (
                    <input type="email" defaultValue={userProfile.email} className="bg-slate-800 border border-slate-700 rounded p-1 text-sm w-full" />
                  ) : (
                    userProfile.email
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Member Since</label>
                <div className="flex items-center gap-2 text-slate-300">
                  <User size={16} className="text-slate-400" />
                  {userProfile.joinedDate}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Preferred Language</label>
                <div className="flex items-center gap-2 text-slate-300">
                  <Globe size={16} className="text-slate-400" />
                  {isEditing ? (
                    <select defaultValue={userProfile.preferredLanguage} className="bg-slate-800 border border-slate-700 rounded p-1 text-sm w-full">
                      <option>English</option>
                      <option>Spanish</option>
                      <option>Vietnamese</option>
                    </select>
                  ) : (
                    userProfile.preferredLanguage
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Notification Preference</label>
                <div className="flex items-center gap-2 text-slate-300">
                  <Bell size={16} className="text-slate-400" />
                  Email & Push
                </div>
              </div>
            </div>
            {isEditing && (
              <div className="mt-6 flex justify-end">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-colors" onClick={() => setIsEditing(false)}>
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
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
          >
            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Shield size={20} className="text-blue-400" />
              Privacy & Security
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                <div>
                  <h4 className="font-medium text-slate-200">Data Deletion Policy</h4>
                  <p className="text-sm text-slate-400">ClearPath automatically deletes un-saved documents after 30 days.</p>
                </div>
                <button className="text-blue-400 text-sm font-medium hover:text-blue-300">Manage</button>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                <div>
                  <h4 className="font-medium text-slate-200">Two-Factor Authentication</h4>
                  <p className="text-sm text-slate-400">Add an extra layer of security to your account.</p>
                </div>
                <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
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
            className="bg-gradient-to-b from-blue-900/40 to-slate-900 border border-blue-800/30 rounded-2xl p-6"
          >
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-blue-400" />
              Your Activity
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="p-2 bg-blue-900/30 rounded-lg text-blue-400">
                    <FileText size={18} />
                  </div>
                  <span>Documents Analyzed</span>
                </div>
                <span className="text-xl font-bold text-slate-100">12</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="p-2 bg-blue-900/30 rounded-lg text-blue-400">
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
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
          >
            <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <HelpCircle size={20} className="text-slate-400" />
              Need Support?
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Having trouble with an analysis or need help navigating ClearPath?
            </p>
            <button className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Contact Support
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
