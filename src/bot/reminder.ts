import { getUserById } from "../db/users.js";
import { getPendingRequestsForUser } from "../db/requests.js";
import { scheduleReminder } from "../jobs/queue.js";
import { config } from "../config.js";
import { getSocket } from "./socket.js";
import { savePending } from "../bot/confirmStore.js";
import { logger, logError } from "../utils/logger.js";

const log = logger.child({ ctx: "bot.reminder" });

export async function sendReminder(
  userId: number,
  requestId: number
): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    log.warn({ userId }, "User not found");
    return;
  }

  const requests = await getPendingRequestsForUser(user.email);
  const request = requests.find((r) => r.id === requestId);
  if (!request) {
    log.info({ userId, requestId }, "Request no longer pending");
    return;
  }

  const message = [
    `👋 Have you finished watching *${request.title}*?`,
    `Reply with:`,
    `✅ yes — delete it`,
    `⏳ no — remind me later`,
    `❌ cancel — stop reminders`
  ].join("\n");

  try {
    const socket = getSocket();
    const sent = await socket.sendMessage(user.phone, { text: message });
    const confirmMsgId = sent?.key?.id;
    if (confirmMsgId) {
      await savePending(confirmMsgId, user.phone, {
        kind: "delete-movie",
        userId: user.id,
        movie: {
          id: request.mediaId,
          title: request.title,
          mediaType: request.type
        }
      });
    }
    log.info({ userId, requestId, title: request.title }, "Reminder sent");

    const retryMs = config.retryMs;
    await scheduleReminder(userId, requestId, retryMs);
    log.info({ userId, requestId, retryMs }, "Retry scheduled");
  } catch (err: unknown) {
    logError("Failed to send reminder", err, {
      userId,
      requestId,
      title: request.title
    });
  }
}
