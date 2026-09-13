"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthCard, FormError } from "@/auth/auth-card";
import type { AuthSession } from "@/auth/types";
import { ApiError, apiFetch, getToken, setSession } from "@/lib/api";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { PasswordInput } from "@/ui/password-input";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    threadsUsername: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getToken()) router.replace("/home");
  }, [router]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await apiFetch<AuthSession>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
          threadsUsername: form.threadsUsername || undefined,
        }),
      });
      if (!session) throw new Error("Registrasi gagal");
      setSession(session.tokens);
      router.replace("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registrasi gagal, coba lagi");
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Buat akun"
      description="Template, link, topik, dan draft kamu terpisah dari akun lain."
      footer={
        <p>
          Sudah punya akun?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Masuk
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" autoComplete="username" value={form.username} onChange={set("username")} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            required
          />
          <p className="text-xs text-muted-foreground">Minimal 8 karakter.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="threads">
            Username Threads <span className="font-normal text-muted-foreground">(opsional)</span>
          </Label>
          <Input id="threads" placeholder="@username" value={form.threadsUsername} onChange={set("threadsUsername")} />
          <p className="text-xs text-muted-foreground">
            Dipakai untuk mendeteksi otomatis draft yang sudah kamu posting.
          </p>
        </div>
        <FormError message={error} />
        <Button type="submit" disabled={loading} className="w-full">
          <UserPlus className="h-4 w-4" />
          {loading ? "Mendaftar…" : "Daftar"}
        </Button>
      </form>
    </AuthCard>
  );
}
