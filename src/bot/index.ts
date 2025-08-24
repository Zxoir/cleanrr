import { initSocket, getSocket, onSocketReady } from "./socket.js";
import { registerHandlers } from "./handlers.js";
import { logger, logError } from "../utils/logger.js";

export async function startBot(): Promise<void> {
  try {
    logger.info("Initializing WhatsApp socket...");
    onSocketReady(registerHandlers);
    await initSocket();

    logger.info("Registering message handlers...");
    const socket = getSocket();
    registerHandlers(socket);

    logger.info("WhatsApp bot started successfully.");
  } catch (err: unknown) {
    logError("Failed to start WhatsApp bot", err, { ctx: "bot.startBot" });
    throw err;
  }
}
