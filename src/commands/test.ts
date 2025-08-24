import { logger, logError } from "../utils/logger.js";

const log = logger.child({ ctx: "commands.test" });

export async function handleTestCommand(jid: string): Promise<string> {
  try {
    log.info({ jid }, "Test command received");

    // Simulate multiple options as text
    const response = [
      "✅ Test command executed successfully!",
      "Please choose an option:",
      "1. Verify your email",
      "2. List your requests",
      "3. Delete a request"
    ].join("\n");

    return response;
  } catch (err: unknown) {
    logError("Failed to run test command", err, { jid });
    return "❌ Error occured.";
  }
}
