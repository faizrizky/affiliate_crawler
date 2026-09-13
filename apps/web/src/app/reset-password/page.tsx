"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthCard, FormError } from "@/auth/auth-card";
import { ApiError, apiFetch } from "@/lib/api";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { PasswordInput } from "@/ui/password-input";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : "Link reset tidak lengkap. Minta link baru dari halaman lupa password.",
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Password minimal 8 karakter");
    if (password !== confirm) return setError("Konfirmasi password tidak sama");
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password }),
      });
      setDone(true);
      setTimeout(() => router.replace("/login"), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset gagal, coba lagi");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="rounded-xl bg-emerald-500/10 px-3 py-3 text-sm text-emerald-700">
        Password berhasil diganti. Mengarahkan ke halaman masuk…
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password baru</Label>
        <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={!token} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Ulangi password baru</Label>
        <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required disabled={!token} />
      </div>
      <FormError message={error} />
      <Button type="submit" disabled={loading || !token} className="w-full">
        <KeyRound className="h-4 w-4" />
        {loading ? "Menyimpan…" : "Simpan password baru"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Buat password baru"
      footer={
        <p>
          <Link href="/forgot-password" className="hover:underline">
            Minta link reset baru
          </Link>
        </p>
      }
    >
      {/* useSearchParams wajib di dalam Suspense pada App Router. */}
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
