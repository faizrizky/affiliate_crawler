"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, clearToken } from "@/lib/api";
import { cn } from "@/lib/utils";

export function UserNav({
  showEmail = false,
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
    <div className={cn("flex items-center gap-2", className)}>
      {showEmail && (
        <span className="hidden max-w-36 truncate text-sm text-muted-foreground lg:block">
          {email ?? "…"}
        </span>
      )}
      <button
        type="button"
        title={email ?? undefined}
        onClick={() => {
          clearToken();
          router.replace("/login");
        }}
        className="inline-flex items-center gap-2 rounded-full bg-card/80 px-5 py-3 text-sm font-semibold text-primary shadow-sm backdrop-blur transition-transform active:scale-[0.97]"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </div>
  );
}
