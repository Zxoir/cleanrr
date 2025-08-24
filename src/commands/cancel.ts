import { getUserByPhone } from "../db/users.js";
import {
  getPendingRequestsForUser,
  markRequestAsCancelled
} from "../db/requests.js";
import { logger, logError } from "../utils/logger.js";

const log = logger.child({ ctx: "commands.cancel" });

export async function handleCancelCommand(
  jid: string,
  text: string
): Promise<string> {
  try {
    const user = await getUserByPhone(jid);
    if (!user) {
      return "❌ Please verify first with: !verify <email>";
    }

    const parts = text.trim().split(/\s+/);
    if (parts.length !== 2) {
      return "❌ Usage: !cancel <id>\n\n(Note: You can find the movie id using the *!list* command)";
    }

    const id = Number(parts[1]);
    if (!Number.isInteger(id)) {
      return "❌ That isn't a valid id\n\n(Note: You can find the movie id using the *!list* command)";
    }

    const requests = await getPendingRequestsForUser(user.email);
    const media = requests.find((r) => r.id === id);
    if (!media) {
      return "❌ That isn't a valid id\n\n(Note: You can find the movie id using the *!list* command)";
    }

    await markRequestAsCancelled(id);
    log.info({ email: user.email, id: id }, "Cancelled request");
    return `🛑 Cancelled ${media.title}, I will no longer bother you about it.`;
  } catch (err: unknown) {
    logError("Cancel command failed", err, { jid });
    return "❌ Cancel request failed due to a server error. Please try again later.";
  }
}
