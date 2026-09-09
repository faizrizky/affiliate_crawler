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
        "sticky top-0 z-40 h-16 border-b border-border bg-card/95 backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/home" className="text-base font-semibold">
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
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-accent/60",
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
