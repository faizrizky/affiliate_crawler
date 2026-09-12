"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { UserNav } from "@/layout/user-nav";

export function TopHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <header className={cn("px-4 pb-2 pt-2 sm:px-6", className)}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Link
          href="/home"
          className="rounded-full bg-card/80 px-5 py-3 text-sm font-bold text-primary shadow-sm backdrop-blur"
        >
          Threads Research
        </Link>
        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 rounded-full bg-card/80 p-1 shadow-sm backdrop-blur md:flex xl:hidden">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
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
