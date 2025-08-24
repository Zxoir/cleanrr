import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  MOVIE_DELAY_DAYS: z.coerce.number().nonnegative().default(3),
  SHOW_DELAY_DAYS: z.coerce.number().nonnegative().default(1),
  RETRY_INTERVAL_HOURS: z.coerce.number().positive().default(6),

  REDIS_URL: z.url().default("redis://localhost:6379"),
  DB_PATH: z.string().optional().default("./data/app.sqlite"),

  WHATSAPP_SESSION_PATH: z.string().default("./session"),

  OVERSEERR_API_URL: z.url(),
  OVERSEERR_API_KEY: z.string().min(1),
  OVERSEERR_WEBHOOK_SECRET: z.string().optional().nullable(),

  RADARR_API_URL: z.url(),
  RADARR_API_KEY: z.string(),
  SONARR_API_URL: z.url(),
  SONARR_API_KEY: z.string()
});

const env = envSchema.parse(process.env);

export const config = {
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  movieDelayMs: env.MOVIE_DELAY_DAYS * 24 * 60 * 60 * 1000,
  showDelayMs: env.SHOW_DELAY_DAYS * 24 * 60 * 60 * 1000,
  retryMs: env.RETRY_INTERVAL_HOURS * 60 * 60 * 1000,

  redisUrl: env.REDIS_URL,
  dbPath: env.DB_PATH,

  whatsappSessionPath: env.WHATSAPP_SESSION_PATH,

  overseerr: {
    apiUrl: env.OVERSEERR_API_URL,
    apiKey: env.OVERSEERR_API_KEY,
    webhookSecret: env.OVERSEERR_WEBHOOK_SECRET ?? undefined
  },

  radarr:
    env.RADARR_API_URL && env.RADARR_API_KEY
      ? { apiUrl: env.RADARR_API_URL, apiKey: env.RADARR_API_KEY }
      : undefined,

  sonarr:
    env.SONARR_API_URL && env.SONARR_API_KEY
      ? { apiUrl: env.SONARR_API_URL, apiKey: env.SONARR_API_KEY }
      : undefined
};
