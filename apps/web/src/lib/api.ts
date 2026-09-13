export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const ACCESS_KEY = "aff_access_token";
const REFRESH_KEY = "aff_refresh_token";
const LEGACY_KEY = "aff_token";

export type AuthTokens = { accessToken: string; refreshToken: string };

// Endpoint auth mengembalikan 401/400 sebagai jawaban normal (password salah,
// link reset kedaluwarsa) — jangan dicoba refresh atau dilempar ke /login.
const AUTH_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
];

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return storage()?.getItem(ACCESS_KEY) ?? null;
}

export function setSession(tokens: AuthTokens) {
  const store = storage();
  store?.setItem(ACCESS_KEY, tokens.accessToken);
  store?.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearToken() {
  const store = storage();
  store?.removeItem(ACCESS_KEY);
  store?.removeItem(REFRESH_KEY);
  try {
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // localStorage bisa diblokir browser; tidak ada yang perlu dibersihkan.
  }
}

let refreshing: Promise<boolean> | null = null;

/** Tukar refresh token dengan pasangan token baru. Satu request untuk semua 401 yang bersamaan. */
function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const refreshToken = storage()?.getItem(REFRESH_KEY);
  if (!refreshToken) return Promise.resolve(false);

  refreshing = fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const tokens = (await res.json()) as AuthTokens;
      setSession(tokens);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<T | undefined> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const isAuthPath = AUTH_PATHS.some((p) => path.startsWith(p));
  if (res.status === 401 && !isAuthPath) {
    // Access token cuma 15 menit: coba perbarui sekali, lalu ulangi request.
    if (!retried && (await refreshSession())) {
      return apiFetch<T>(path, init, true);
    }
    clearToken();
    window.location.assign("/login");
    throw new ApiError(401, "Session berakhir, silakan login kembali");
  }

  if (res.status === 204) return undefined;

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const raw = (body as { message?: string | string[] } | undefined)
      ?.message;
    const message =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? raw.join(", ")
          : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return body as T;
}
