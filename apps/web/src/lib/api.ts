export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const TOKEN_KEY = "aff_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
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

  if (res.status === 401 && !path.startsWith("/auth/login")) {
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
