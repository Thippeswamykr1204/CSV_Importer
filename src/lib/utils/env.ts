import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required for AI mapping").optional(),
});

/**
 * Next.js route handlers don't have a single process-start hook, so we
 * validate lazily on first access rather than at module load — this
 * still fails fast (on the first request) with a clear error instead of
 * letting an undefined key surface as a confusing SDK error deep in
 * ai-mapper.service.ts.
 */
export function getEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}
