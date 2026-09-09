"use client";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { BottomNav } from "./bottom-nav";
import { DesktopSidebar } from "./desktop-sidebar";
import { TopHeader } from "./top-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  return (
    <>
      <DesktopSidebar />
      <TopHeader className="md:hidden" />
      <TopHeader className="hidden md:block xl:hidden" />
      <main
        className={cn(
          "min-h-screen transition-[padding]",
          sidebarCollapsed ? "xl:pl-20" : "xl:pl-64",
        )}
      >
        <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6 md:pb-12 lg:pt-12">
          {children}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
