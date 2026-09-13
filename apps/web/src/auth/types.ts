import type { AuthTokens } from "@/lib/api";

export type UserProfile = {
  id: string;
  username: string;
  email: string;
  name: string | null;
  threadsUsername: string | null;
  createdAt: string;
};

export type AuthSession = { user: UserProfile; tokens: AuthTokens };
