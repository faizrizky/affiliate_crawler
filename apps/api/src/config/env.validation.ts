import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CRAWLER_API_URL: z.url(),
  // Budget API menunggu crawler (detik). Harus >= worst-case crawler:
  // threads_search_attempts(3) × (threads_browser_timeout(30s) +
  // threads_content_wait(45s)) + backoff ≈ 228s+. Sinkron dengan
  // apps/crawler/app/config/settings.py.
  CRAWLER_TIMEOUT: z.coerce.number().int().min(1).default(300),
  CRAWLER_CONCURRENCY: z.coerce.number().int().min(1).default(4),
  API_PORT: z.coerce.number().int().min(1).default(3001),
  OPENAI_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  // Opsional: kalau kosong, diturunkan dari JWT_SECRET dengan label berbeda
  // (lihat auth.service.ts) supaya token akses tidak bisa dipakai sebagai refresh.
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_RESET_SECRET: z.string().min(32).optional(),
  // Base URL web untuk link reset password di email.
  APP_URL: z.url().default("http://localhost:3000"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

export function validateEnv(env: Record<string, unknown>) {
  const parsed = schema.parse(env);
  return parsed;
}
