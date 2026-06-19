import Sidebar from '@/components/app-shell/Sidebar';
import React from 'react';
import FeedBack from './app/FeedBack';

const HelpCenterLayout = () => {
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <FeedBack />
      </main>
    </div>
  );
};

export default HelpCenterLayout;
