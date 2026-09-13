"use client";

import { KeyRound, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError } from "@/auth/auth-card";
import { useAuth } from "@/auth/auth-context";
import type { AuthSession } from "@/auth/types";
import { ApiError, apiFetch, setSession } from "@/lib/api";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { PasswordInput } from "@/ui/password-input";

export function ProfileForms() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState({
    username: user.username,
    email: user.email,
    threadsUsername: user.threadsUsername ?? "",
  });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    try {
      const session = await apiFetch<AuthSession>("/user/profile", {
        method: "PATCH",
        body: JSON.stringify({
          username: profile.username,
          email: profile.email,
          threadsUsername: profile.threadsUsername || null,
        }),
      });
      if (session) {
        // Username/email ada di klaim token -> pakai token yang baru terbit.
        setSession(session.tokens);
        setUser(session.user);
      }
      toast.success("Profil disimpan");
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Gagal menyimpan profil");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (passwords.newPassword.length < 8) return setPasswordError("Password baru minimal 8 karakter");
    if (passwords.newPassword !== passwords.confirm) return setPasswordError("Konfirmasi password tidak sama");
    setSavingPassword(true);
    setPasswordError(null);
    try {
      const session = await apiFetch<AuthSession>("/user/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        }),
      });
      // Sesi di perangkat lain dicabut server; perangkat ini lanjut dengan token baru.
      if (session) setSession(session.tokens);
      setPasswords({ currentPassword: "", newPassword: "", confirm: "" });
      toast.success("Password diganti. Sesi di perangkat lain sudah dikeluarkan.");
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Gagal mengganti password");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-transparent p-5 shadow-sm">
        <h2 className="text-base font-semibold">Data akun</h2>
        <form onSubmit={saveProfile} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={profile.username} onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="threads">Username Threads</Label>
            <Input id="threads" placeholder="@username" value={profile.threadsUsername} onChange={(e) => setProfile((p) => ({ ...p, threadsUsername: e.target.value }))} />
            <p className="text-xs text-muted-foreground">
              Auto-publish memeriksa post akun ini. Kosongkan untuk mematikan deteksi otomatis.
            </p>
          </div>
          <FormError message={profileError} />
          <Button type="submit" disabled={savingProfile} className="self-start">
            <Save className="h-4 w-4" />
            {savingProfile ? "Menyimpan…" : "Simpan profil"}
          </Button>
        </form>
      </Card>

      <Card className="border-transparent p-5 shadow-sm">
        <h2 className="text-base font-semibold">Ganti password</h2>
        <form onSubmit={savePassword} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current">Password saat ini</Label>
            <PasswordInput id="current" autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new">Password baru</Label>
            <PasswordInput id="new" autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Ulangi password baru</Label>
            <PasswordInput id="confirm" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))} required />
          </div>
          <FormError message={passwordError} />
          <Button type="submit" disabled={savingPassword} className="self-start">
            <KeyRound className="h-4 w-4" />
            {savingPassword ? "Menyimpan…" : "Ganti password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
