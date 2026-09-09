export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T | undefined> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });

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
