"use client"; // Required because we are introducing state

import React, { useState } from "react";
import Sidebar from "@/components/app-shell/Sidebar";
import HelpCenter from "./app/HelpCenter";

const HelpCenterLayout = () => {
  // 1. Define the collapse state here
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* 2. Pass the state and setter as props down to Sidebar */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      
      <main className={`flex-1 min-w-0 overflow-y-auto transition-all duration-300`}>
        <HelpCenter />
      </main>
    </div>
  );
};

export default HelpCenterLayout;