"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/auth/auth-context";
import { ConfirmDialog } from "@/common/confirm-dialog";
import { clearToken } from "@/lib/api";
import { cn } from "@/lib/utils";

export function UserNav({ className }: { showEmail?: boolean; className?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Link
        href="/profile"
        title={user.email}
        className="inline-flex max-w-44 items-center gap-2 rounded-full bg-card/80 px-4 py-3 text-sm font-semibold text-foreground shadow-sm backdrop-blur transition-transform active:scale-[0.97]"
      >
        <UserRound className="h-4 w-4 shrink-0 text-primary" />
        {/* md–lg: nav 5 menu ikut tampil di header, jadi teks dijadikan
            sr-only supaya header tablet tidak meluap keluar layar. */}
        <span className="truncate md:max-lg:sr-only">@{user.username}</span>
      </Link>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        aria-label="Logout"
        className="inline-flex items-center gap-2 rounded-full bg-card/80 px-5 py-3 text-sm font-semibold text-primary shadow-sm backdrop-blur transition-transform active:scale-[0.97] md:max-lg:px-4"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline md:max-lg:hidden">Logout</span>
      </button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Keluar dari akun?"
        description={`Kamu akan keluar dari @${user.username}. Sesi di perangkat ini dihapus dan kamu perlu login lagi.`}
        confirmLabel="Logout"
        cancelLabel="Batal"
        destructive
        onConfirm={() => {
          setConfirmOpen(false);
          clearToken();
          router.replace("/login");
        }}
      />
    </div>
  );
}
