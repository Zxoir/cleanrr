import * as Baileys from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import { isBoom } from "@hapi/boom";
import { markResetOnNextBoot } from "./sessionReset.js";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { logger, logError } from "../utils/logger.js";
import qrcode from "qrcode-terminal";

const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = Baileys;

// subscribers to (re)bind handlers whenever a fresh socket is created
type ReadyHandler = (sock: WASocket) => void;
const readyHandlers = new Set<ReadyHandler>();
export function onSocketReady(fn: ReadyHandler) {
  readyHandlers.add(fn);
  if (socketInstance) fn(socketInstance);
}

let socketInstance: WASocket | undefined;
const log = logger.child({ ctx: "bot.socket" });

let reconnecting = false;
const retry = {
  attempts: 0,
  firstAt: 0,
  backoffMs: 1000
};

const BACKOFF_MAX_MS = 30_000;
const RESET_AFTER_ATTEMPTS = 3;
const RESET_WINDOW_MS = 60_000;

function resetRetryWindow() {
  retry.attempts = 0;
  retry.firstAt = Date.now();
  retry.backoffMs = 1000;
}

function scheduleReconnect(fn: () => void) {
  const jitter = Math.floor(Math.random() * 250);
  const delay = Math.min(retry.backoffMs + jitter, BACKOFF_MAX_MS);
  setTimeout(fn, delay);
  retry.backoffMs = Math.min(retry.backoffMs * 2, BACKOFF_MAX_MS);
}

export async function initSocket(): Promise<void> {
  try {
    const sessionDir = path.resolve(config.whatsappSessionPath);
    fs.mkdirSync(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false, // we render QR ourselves
      logger: logger.child({ ctx: "baileys" })
    });

    socketInstance = sock;

    // (re)bind external handlers every time we create a socket
    for (const fn of readyHandlers) fn(sock);

    sock.ev.on("creds.update", saveCreds);

    let lastQr: string | undefined;

    sock.ev.on(
      "connection.update",
      async ({ connection, lastDisconnect, qr }) => {
        if (qr && qr !== lastQr) {
          lastQr = qr;
          qrcode.generate(qr, { small: true });
          log.info("Scan the QR above to link WhatsApp");
        }

        if (connection === "open") {
          log.info("WhatsApp socket connected");
          reconnecting = false;
          resetRetryWindow();
          return;
        }

        if (connection === "close") {
          const err = lastDisconnect?.error;
          const status = (isBoom(err) && err.output?.statusCode) as
            | number
            | undefined;
          const loggedOut =
            status === DisconnectReason.loggedOut || status === 401;

          const now = Date.now();
          if (retry.attempts === 0 || now - retry.firstAt > RESET_WINDOW_MS) {
            resetRetryWindow();
          }
          retry.attempts += 1;

          // Fatal: explicit logout or too many failures in a short window
          if (loggedOut || retry.attempts >= RESET_AFTER_ATTEMPTS) {
            log.warn(
              { status, attempts: retry.attempts },
              "Fatal WA close → reset on next boot"
            );
            try {
              await socketInstance?.logout();
            } catch {
              // ignore
            }
            markResetOnNextBoot(); // entrypoint will clear session next boot
            process.exit(100); // Docker restarts the container
            return;
          }

          // Transient close → backoff reconnect
          if (!reconnecting) {
            reconnecting = true;
            scheduleReconnect(() => {
              reconnecting = false;
              initSocket().catch((e) =>
                logError("Reconnection failed", e, { ctx: "bot.socket" })
              );
            });
          }
        }
      }
    );
  } catch (e) {
    logError("Failed to initialize WhatsApp socket", e, { ctx: "bot.socket" });
    throw e;
  }
}

export function getSocket(): WASocket {
  if (!socketInstance) {
    throw new Error("Socket not initialized. Call initSocket() first.");
  }
  return socketInstance;
}
