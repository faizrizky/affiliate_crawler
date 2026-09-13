import { createHash } from "node:crypto";
import { sign, verify, type JwtPayload as RawPayload } from "jsonwebtoken";

export type TokenType = "access" | "refresh" | "reset";

export type TokenClaims = {
  sub: string;
  username: string;
  email: string;
  typ: TokenType;
  iat: number;
};

const LIFETIME: Record<TokenType, string> = {
  access: "15m",
  refresh: "7d",
  reset: "30m",
};

/**
 * Secret per jenis token. Kalau secret khusus tidak diset, turunkan dari
 * JWT_SECRET dengan label berbeda — satu secret yang sama untuk semua jenis
 * akan membuat access token bisa dipakai sebagai reset token.
 */
export function secretFor(
  typ: TokenType,
  base: string,
  overrides: Partial<Record<TokenType, string | undefined>>,
): string {
  const explicit = overrides[typ];
  if (explicit) return explicit;
  if (typ === "access") return base;
  return createHash("sha256").update(`${typ}:${base}`).digest("hex");
}

export function issueToken(
  claims: Omit<TokenClaims, "typ" | "iat">,
  typ: TokenType,
  secret: string,
): string {
  return sign({ ...claims, typ }, secret, { expiresIn: LIFETIME[typ] } as never);
}

export function readToken(token: string, typ: TokenType, secret: string): TokenClaims {
  const payload = verify(token, secret) as RawPayload | string;
  if (
    typeof payload === "string" ||
    payload.typ !== typ ||
    typeof payload.sub !== "string" ||
    typeof payload.iat !== "number"
  ) {
    throw new Error("invalid token");
  }
  return {
    sub: payload.sub,
    username: String(payload.username ?? ""),
    email: String(payload.email ?? ""),
    typ,
    iat: payload.iat,
  };
}
