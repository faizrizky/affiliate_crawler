"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard, FormError } from "@/auth/auth-card";
import { ApiError, apiFetch } from "@/lib/api";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengirim, coba lagi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Lupa password"
      description="Masukkan email akunmu, kami kirim link untuk membuat password baru."
      footer={
        <p>
          <Link href="/login" className="hover:underline">
            Kembali ke halaman masuk
          </Link>
        </p>
      }
    >
      {sent ? (
        <p role="status" className="rounded-xl bg-emerald-500/10 px-3 py-3 text-sm text-emerald-700">
          Kalau <strong>{email}</strong> terdaftar, link reset sudah dikirim. Link berlaku 30 menit
          dan hanya bisa dipakai sekali.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <FormError message={error} />
          <Button type="submit" disabled={loading} className="w-full">
            <Mail className="h-4 w-4" />
            {loading ? "Mengirim…" : "Kirim link reset"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
