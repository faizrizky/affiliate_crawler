"use client";

import { LogIn } from "lucide-react";
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

export default function LoginPage() {
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getToken()) router.replace("/home");
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await apiFetch<AuthSession>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ usernameOrEmail, password }),
      });
      if (!session) throw new Error("Login gagal");
      setSession(session.tokens);
      router.replace("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login gagal, coba lagi");
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Masuk"
      description="Pakai username atau email akunmu."
      footer={
        <>
          <p>
            Belum punya akun?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Daftar
            </Link>
          </p>
          <p>
            <Link href="/forgot-password" className="hover:underline">
              Lupa password?
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identifier">Username atau email</Label>
          <Input
            id="identifier"
            autoComplete="username"
            value={usernameOrEmail}
            onChange={(e) => setUsernameOrEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <FormError message={error} />
        <Button type="submit" disabled={loading} className="w-full">
          <LogIn className="h-4 w-4" />
          {loading ? "Masuk…" : "Masuk"}
        </Button>
      </form>
    </AuthCard>
  );
}
