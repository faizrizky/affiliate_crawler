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
});

export function validateEnv(env: Record<string, unknown>) {
  const parsed = schema.parse(env);
  return parsed;
}
