import { getUserByPhone } from "../db/users.js";
import { getPendingRequestsForUser } from "../db/requests.js";
import dayjs from "dayjs";
import { logger, logError } from "../utils/logger.js";

const log = logger.child({ ctx: "commands.list" });

export async function handleListCommand(jid: string): Promise<string> {
  try {
    const user = await getUserByPhone(jid);
    if (!user) return "❌ Please verify first with: !verify <email>";

    const requests = await getPendingRequestsForUser(user.email);
    if (requests.length === 0) return "✅ No tracked items. Enjoy the silence.";

    const now = dayjs();
    const lines = requests.map((req) => {
      const daysLeft = Math.max(0, dayjs(req.dueAt).diff(now, "day"));
      return `• ${req.title} (${req.type}) (id: ${req.id}) — ${daysLeft} day(s) remaining`;
    });

    log.info(
      { userId: user.id, count: lines.length },
      "Listed pending requests"
    );
    return ["📋 Tracked content:", ...lines].join("\n");
  } catch (err: unknown) {
    logError("Failed to list tracked content", err, { jid });
    return "❌ Could not retrieve your tracked content. Please try again later.";
  }
}
