"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Bell, Moon, Sun, Type, ShieldAlert, LogOut } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    emailAlerts: true,
    weeklyDigest: false,
    highContrast: false,
    largeText: false,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-100 mb-2">Settings</h1>
        <p className="text-slate-400">Customize your ClearPath experience.</p>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/30">
            <h2 className="text-lg font-semibold text-slate-200">Appearance & Accessibility</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg text-slate-400"><Moon size={20} /></div>
                <div>
                  <div className="font-medium text-slate-200">Theme</div>
                  <div className="text-sm text-slate-400">Select your preferred interface theme.</div>
                </div>
              </div>
              <select className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-xl py-2 px-3 focus:ring-1 focus:ring-blue-500 outline-none">
                <option>System Default</option>
                <option>Dark Mode</option>
                <option>Light Mode</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg text-slate-400"><Type size={20} /></div>
                <div>
                  <div className="font-medium text-slate-200">Large Text</div>
                  <div className="text-sm text-slate-400">Increase the size of text across the app.</div>
                </div>
              </div>
              <button 
                onClick={() => toggleSetting('largeText')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.largeText ? 'bg-blue-600' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.largeText ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </motion.section>

        {/* Notifications */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/30">
            <h2 className="text-lg font-semibold text-slate-200">Notifications</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg text-slate-400"><Bell size={20} /></div>
                <div>
                  <div className="font-medium text-slate-200">Email Alerts</div>
                  <div className="text-sm text-slate-400">Get notified about approaching deadlines.</div>
                </div>
              </div>
              <button 
                onClick={() => toggleSetting('emailAlerts')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.emailAlerts ? 'bg-blue-600' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.emailAlerts ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg text-slate-400"><Globe size={20} /></div>
                <div>
                  <div className="font-medium text-slate-200">Weekly Digest</div>
                  <div className="text-sm text-slate-400">Receive a weekly summary of your history.</div>
                </div>
              </div>
              <button 
                onClick={() => toggleSetting('weeklyDigest')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.weeklyDigest ? 'bg-blue-600' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.weeklyDigest ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </motion.section>

        {/* Danger Zone */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900 border border-rose-900/50 rounded-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/30">
            <h2 className="text-lg font-semibold text-rose-500 flex items-center gap-2">
              <ShieldAlert size={20} />
              Safety & Trust
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-400">
              ClearPath is designed to empower you with information, but it does not replace formal legal or medical advice.
            </p>
            <div className="pt-4 flex items-center justify-between border-t border-slate-800">
              <span className="font-medium text-slate-200">Sign out of all devices</span>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm transition-colors">
                <LogOut size={16} /> Log Out
              </button>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
