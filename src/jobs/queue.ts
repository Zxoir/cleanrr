import { Queue, JobsOptions, JobType } from "bullmq";
import { Redis } from "ioredis";
import { logger, logError } from "../utils/logger.js";
import { config } from "../config.js";

const baseRedisOpts = {
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false
};

function createRedisConnection(): Redis {
  return new Redis(config.redisUrl, baseRedisOpts);
}

export const connection = createRedisConnection();

export const reminderQueue = new Queue<{ userId: number; requestId: number }>(
  "reminders",
  {
    connection
  }
);

/** Stable job options for idempotency + resilience */
const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 60_000 }, // 1m, 2m, 4m, ...
  removeOnComplete: true,
  removeOnFail: 100
};

/** Schedule after a delay in ms; returns jobId */
export async function scheduleReminder(
  userId: number,
  requestId: number,
  delayMs: number
): Promise<string> {
  const jobId = `reminder:${userId}:${requestId}`;
  try {
    await reminderQueue.add(
      "send-reminder",
      { userId, requestId },
      {
        ...defaultJobOptions,
        jobId,
        delay: Math.max(0, delayMs)
      }
    );
    logger.info({ userId, requestId, delayMs }, "Scheduled reminder");
    return jobId;
  } catch (err: unknown) {
    logError("Failed to schedule reminder", err, {
      userId,
      requestId,
      delayMs
    });
    throw err;
  }
}

/** Schedule for a specific epoch ms time; returns jobId */
export async function scheduleReminderAt(
  userId: number,
  requestId: number,
  dueAtMs: number
): Promise<string> {
  return scheduleReminder(userId, requestId, dueAtMs - Date.now());
}

/** Remove all outstanding reminder jobs for a user (delayed/waiting); returns removed count */
export async function removeReminderJobsForUser(
  userId: number
): Promise<number> {
  try {
    const statuses: JobType[] = ["delayed", "waiting"];
    const jobs = await reminderQueue.getJobs(statuses, 0, 10_000, true);
    const userJobs = jobs.filter((job) => job.data.userId === userId);
    await Promise.all(userJobs.map((job) => job.remove()));
    const removed = userJobs.length;
    logger.info({ userId, removed }, "Removed reminder jobs for user");
    return removed;
  } catch (err: unknown) {
    logError("Failed to remove reminder jobs for user", err, { userId });
    return 0;
  }
}

export default connection;
