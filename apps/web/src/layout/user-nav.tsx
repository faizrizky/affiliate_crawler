"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/auth/auth-context";
import { clearToken } from "@/lib/api";
import { cn } from "@/lib/utils";

export function UserNav({ className }: { showEmail?: boolean; className?: string }) {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Link
        href="/profile"
        title={user.email}
        className="inline-flex max-w-44 items-center gap-2 rounded-full bg-card/80 px-4 py-3 text-sm font-semibold text-foreground shadow-sm backdrop-blur transition-transform active:scale-[0.97]"
      >
        <UserRound className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">@{user.username}</span>
      </Link>
      <button
        type="button"
        onClick={() => {
          clearToken();
          router.replace("/login");
        }}
        className="inline-flex items-center gap-2 rounded-full bg-card/80 px-5 py-3 text-sm font-semibold text-primary shadow-sm backdrop-blur transition-transform active:scale-[0.97]"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </div>
  );
}
