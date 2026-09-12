"use client";

import { BottomNav } from "./bottom-nav";
import { DesktopSidebar } from "./desktop-sidebar";
import { TopHeader } from "./top-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DesktopSidebar />
      <main className="min-h-screen xl:pl-24">
        <TopHeader />
        <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6 md:pb-12">
          {children}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
