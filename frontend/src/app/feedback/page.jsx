"use client";
import Sidebar from "@/components/app-shell/Sidebar";
import React from "react";
import FeedBack from "./app/FeedBack";

import  { useState } from "react";

const HelpCenterLayout = () => {
    const [collapsed, setCollapsed] = useState(false);
  
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <FeedBack />
      </main>
    </div>
  );
};

export default HelpCenterLayout;
