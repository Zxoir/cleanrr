import type { Server } from "http";
import type { Worker } from "bullmq";

import { initDatabase } from "./db/init.js";
import { startBot } from "./bot/index.js";
import { startWebhookServer } from "./server.js";
import { restoreScheduledJobs, startReminderWorker } from "./jobs/scheduler.js";
import connection, { reminderQueue } from "./jobs/queue.js";
import { logger, logError } from "./utils/logger.js";

let server: Server | undefined;
let worker: Worker | undefined;

async function main(): Promise<void> {
  try {
    logger.info("Initializing database...");
    await initDatabase();

    logger.info("Starting WhatsApp bot...");
    await startBot();

    logger.info("Starting webhook server...");
    server = startWebhookServer();

    logger.info("Restoring scheduled jobs...");
    await restoreScheduledJobs();

    logger.info("Starting reminder worker...");
    // Prefer startReminderWorker() => Worker
    const maybeWorker = startReminderWorker() as unknown;
    if (maybeWorker && typeof maybeWorker === "object") {
      worker = maybeWorker as Worker;
    }

    logger.info("cleanrr started successfully.");
  } catch (error: unknown) {
    logError("Fatal error during startup", error, { ctx: "index.main" });
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.warn({ signal }, "Graceful shutdown initiated");

  // Close BullMQ worker
  try {
    await worker?.close();
    logger.info("Worker closed");
  } catch (err: unknown) {
    logError("Error closing worker", err);
  }

  // Close BullMQ queue
  try {
    await reminderQueue.close();
    logger.info("Queue closed");
  } catch (err: unknown) {
    logError("Error closing queue", err);
  }

  // Close Redis connection
  try {
    await connection.quit();
    logger.info("Redis connection closed");
  } catch (err: unknown) {
    logError("Error closing Redis connection", err);
  }

  // Close HTTP server
  try {
    await new Promise<void>((resolve) => {
      if (!server) return resolve();
      server.close((e?: Error) => {
        if (e) logError("Error closing HTTP server", e);
        else logger.info("HTTP server closed");
        resolve();
      });
    });
  } catch (err: unknown) {
    logError("Error during HTTP server shutdown", err);
  }

  logger.info("Shutdown complete");
  process.exit(0);
}

process.once("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

process.on("uncaughtException", (err) => {
  logError("Uncaught exception", err);
});
process.on("unhandledRejection", (reason) => {
  logError("Unhandled rejection", reason as unknown);
});

void main();
