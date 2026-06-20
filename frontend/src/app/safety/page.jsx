'use client'

import { useState } from "react";
import Sidebar from "@/components/app-shell/Sidebar";
import React from "react";
import SafetyTrust from "./app/SafetyTrust";
const HelpCenterLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex min-h-screen bg-slate-950">
       <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      
      <main className="flex-1 min-w-0 overflow-y-auto">
        <SafetyTrust />
      </main>
    </div>
  );
};

export default HelpCenterLayout;
