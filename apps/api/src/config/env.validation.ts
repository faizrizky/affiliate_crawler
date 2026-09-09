import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CRAWLER_API_URL: z.url(),
  CRAWLER_TIMEOUT: z.coerce.number().int().min(1).default(60),
  CRAWLER_CONCURRENCY: z.coerce.number().int().min(1).default(4),
  API_PORT: z.coerce.number().int().min(1).default(3001),
  OPENAI_API_KEY: z.string().optional(),
});

export function validateEnv(env: Record<string, unknown>) {
  const parsed = schema.parse(env);
  return parsed;
}
