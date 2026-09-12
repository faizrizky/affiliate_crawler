"use client";

import { FileText, Home, Inbox, Link2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ICONS = [Home, FileText, Link2, Inbox];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around gap-2 rounded-[1.75rem] bg-card/95 px-2 py-3 shadow-lg backdrop-blur">
        {NAV_ITEMS.map((item, i) => {
          const Icon = ICONS[i] ?? Home;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1 text-[11px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon
                className={cn("h-5 w-5", active && "fill-primary/15")}
                strokeWidth={active ? 2.4 : 2}
              />
              {item.label}
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  active ? "bg-primary" : "bg-transparent",
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
