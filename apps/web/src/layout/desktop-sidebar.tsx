"use client";

import { FileText, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ICONS = [Home, FileText];

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-6 left-0 z-40 hidden w-20 flex-col items-center justify-center gap-3 rounded-r-[2rem] bg-card/85 py-8 shadow-sm backdrop-blur xl:flex">
      <nav className="flex flex-col items-center gap-3">
        {NAV_ITEMS.map((item, i) => {
          const Icon = ICONS[i] ?? Home;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl transition-colors",
                active
                  ? "bg-secondary text-primary"
                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "fill-primary/15")} />
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
