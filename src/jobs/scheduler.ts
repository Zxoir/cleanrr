import { Worker, Job } from "bullmq";
import { connection, reminderQueue, scheduleReminderAt } from "./queue.js";
import { getDb } from "../db/init.js";
import { logger, logError } from "../utils/logger.js";
import { sendReminder } from "../bot/reminder.js";

const log = logger.child({ ctx: "jobs.scheduler" });

/** Worker to actually deliver reminders */
export function startReminderWorker(): Worker {
  const worker = new Worker<{ userId: number; requestId: number }>(
    reminderQueue.name,
    async (job: Job<{ userId: number; requestId: number }>) => {
      const { userId, requestId } = job.data;
      await sendReminder(userId, requestId);
    },
    { connection }
  );

  worker.on("completed", (job) =>
    log.info({ jobId: job.id }, "Reminder job completed")
  );
  worker.on("failed", (job, err) =>
    logError("Reminder job failed", err, { jobId: job?.id })
  );

  log.info("Reminder worker started");
  return worker;
}

/** Re-schedule any pending DB items on startup (idempotent via jobId) */
export async function restoreScheduledJobs(): Promise<void> {
  try {
    const db = getDb();
    // Join requests with users to get numeric userId
    const rows = await db.all<
      {
        id: number;
        email: string;
        userId: number;
        dueAt: number;
      }[]
    >(
      `
      SELECT r.id, r.email, u.id as userId, r.dueAt
      FROM requests r
      JOIN users u ON u.email = r.email
      WHERE r.status = 'pending'
      ORDER BY r.dueAt ASC
    `
    );

    let restored = 0;
    for (const r of rows) {
      const next = r.dueAt > Date.now() ? r.dueAt : Date.now();
      await scheduleReminderAt(r.userId, r.id, next);
      restored++;
    }
    log.info({ restored }, "Restored scheduled jobs");
  } catch (err: unknown) {
    logError("Failed to restore scheduled jobs", err);
  }
}
