import { fetchOverseerrUserByEmail } from "../services/overseerr.js";
import { saveUserPhoneNumber } from "../db/users.js";
import { logger, logError } from "../utils/logger.js";

const log = logger.child({ ctx: "commands.verify" });

export async function handleVerifyCommand(
  jid: string,
  text: string
): Promise<string> {
  const parts = text.trim().split(/\s+/);
  if (parts.length !== 2) {
    return "❌ Usage: !verify <email>";
  }

  const email = parts[1].toLowerCase();
  logger.info("Received email" + email);
  try {
    const overseerrUser = await fetchOverseerrUserByEmail(email);
    if (!overseerrUser) {
      log.warn({ email }, "No Overseerr user found");
      return "❌ No Overseerr account found for that email.";
    }

    await saveUserPhoneNumber(overseerrUser.id, overseerrUser.email, jid);
    log.info(
      { userId: overseerrUser.id, email },
      "Verified user linked to JID"
    );
    return `✅ Verified and linked to Overseerr account: ${email}`;
  } catch (err: unknown) {
    logError("Verification failed", err, { email });
    return "❌ Verification failed due to a server error. Please try again later.";
  }
}
