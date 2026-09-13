"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { UserProfile } from "./types";

type AuthContextValue = {
  user: UserProfile;
  setUser: (user: UserProfile) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: UserProfile;
  children: React.ReactNode;
}) {
  const [user, setUserState] = useState(initialUser);
  const setUser = useCallback((next: UserProfile) => setUserState(next), []);
  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;
}

/** User yang sedang login. Hanya tersedia di dalam AuthGate (halaman dashboard). */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth dipakai di luar AuthProvider");
  return ctx;
}
