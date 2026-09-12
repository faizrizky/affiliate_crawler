"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { UserNav } from "@/layout/user-nav";

export function TopHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-background/85 px-4 py-3 backdrop-blur sm:px-6",
        className,
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-full bg-card px-4 py-2 shadow-sm">
        <Link
          href="/home"
          className="shrink-0 text-sm font-semibold text-primary"
        >
          Threads Research
        </Link>
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <UserNav />
        </div>
      </div>
    </header>
  );
}
