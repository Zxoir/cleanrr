import pino from "pino";

const transport =
  process.env.NODE_ENV === "production"
    ? undefined
    : pino.transport({
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" }
      });

export const logger = pino(
  {
    name: "cleanrr",
    level: process.env.LOG_LEVEL || "info",
    base: { pid: false },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "overseerr.apiKey",
        "radarr.apiKey",
        "sonarr.apiKey",
        "overseerr.webhookSecret",
        "req.headers.authorization"
      ],
      censor: "[REDACTED]"
    }
  },
  transport
);

export function logError(
  message: string,
  err: unknown,
  extra?: Record<string, unknown>
): void {
  if (err instanceof Error) {
    logger.error({ err, ...(extra || {}) }, message);
  } else {
    logger.error({ err: String(err), ...(extra || {}) }, message);
  }
}
