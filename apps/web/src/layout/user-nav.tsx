"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, clearToken } from "@/lib/api";
import { cn } from "@/lib/utils";

export function UserNav({
  showEmail = true,
  className,
}: {
  showEmail?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ email: string }>("/auth/me")
      .then((me) => me && setEmail(me.email))
      .catch(() => undefined);
  }, []);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {showEmail && (
        <span className="hidden max-w-36 truncate text-sm text-muted-foreground md:block">
          {email ?? "…"}
        </span>
      )}
      <button
        type="button"
        aria-label="Sign out"
        onClick={() => {
          clearToken();
          router.replace("/login");
        }}
        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent/60"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
