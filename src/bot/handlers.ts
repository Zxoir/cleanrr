import { WASocket, proto, MessageUpsertType } from "@whiskeysockets/baileys";
import { handleVerifyCommand } from "../commands/verify.js";
import { handleListCommand } from "../commands/list.js";
import { handleDeleteCommand } from "../commands/delete.js";
import { handleCancelCommand } from "../commands/cancel.js";
import { logger, logError } from "../utils/logger.js";
import { handleTestCommand } from "../commands/test.js";
import { deleteMedia } from "../services/deleter.js";
import { removeReminderJobsForUser } from "../jobs/queue.js";
import {
  savePending,
  peekByMsgId,
  peekLastForJid,
  clearPending
} from "../bot/confirmStore.js";

const log = logger.child({ ctx: "bot.handlers" });
const isYes = (s: string) => /^(?:y|yes|✅)$/i.test(s.trim());
const isNo = (s: string) => /^(?:n|no|❌)$/i.test(s.trim());

// keep track of sockets already bound to avoid duplicate listeners after reconnects
const bound = new WeakSet<WASocket>();

export function registerHandlers(socket: WASocket): void {
  if (bound.has(socket)) return;
  bound.add(socket);

  socket.ev.on(
    "messages.upsert",
    async ({
      messages,
      type
    }: {
      messages: proto.IWebMessageInfo[];
      type: MessageUpsertType;
    }) => {
      if (type !== "notify") return;

      const msg = messages[0];
      if (!msg?.message || msg.key.fromMe) return;

      const jid = msg.key.remoteJid;
      if (!jid) return;

      const text =
        msg.message.conversation ?? msg.message.extendedTextMessage?.text ?? "";
      const trimmed = text.trim();
      if (!trimmed) return;

      const messageId = msg.key.id;
      const quotedId =
        msg.message?.extendedTextMessage?.contextInfo?.stanzaId ?? undefined;
      const command = trimmed.split(/\s+/, 1)[0];

      try {
        const pending =
          (await peekByMsgId(quotedId)) ?? (await peekLastForJid(jid));

        if (pending && pending.jid === jid) {
          if (isYes(trimmed)) {
            try {
              await deleteMedia({
                type: pending.context.movie.mediaType,
                mediaId: pending.context.movie.id,
                title: pending.context.movie.title
              });
              await removeReminderJobsForUser(pending.context.userId);
              await clearPending(pending.confirmMsgId, jid);
              await socket.sendMessage(jid, {
                text: `🗑️ Deleted *${pending.context.movie.title}*.`
              });
            } catch (err) {
              logError("Delete failed", err, {
                jid,
                movie: pending.context.movie
              });
              await socket.sendMessage(jid, {
                text: "❌ Delete failed due to a server error. Please try again later."
              });
            }
            return;
          }

          if (isNo(trimmed)) {
            await clearPending(pending.confirmMsgId, jid);
            await socket.sendMessage(jid, { text: "✅ Okay, keeping it." });
            return;
          }

          // If they replied something else to our confirmation message
          if (quotedId) {
            await socket.sendMessage(jid, {
              text: "Please reply with `yes` to delete or `no` to cancel."
            });
            return;
          }
          // Otherwise fall through to regular command routing
        }

        let reply: string;

        if (trimmed.startsWith("!verify")) {
          reply = await handleVerifyCommand(jid, trimmed);
        } else if (trimmed === "!list") {
          reply = await handleListCommand(jid);
        } else if (trimmed.startsWith("!delete")) {
          const out = await handleDeleteCommand(jid, trimmed);

          if ("confirm" in out && out.confirm) {
            // Quote user's message so their reply carries `stanzaId`
            const sent = await socket.sendMessage(jid, {
              text: out.text
            });
            const confirmMsgId = sent?.key?.id;
            await savePending(confirmMsgId!, jid, {
              kind: "delete-movie",
              userId: out.confirm.userId,
              movie: out.confirm.movie
            });
            // nothing else to send (already sent)
            return;
          } else {
            reply = out.text;
          }
        } else if (trimmed.startsWith("!cancel")) {
          reply = await handleCancelCommand(jid, trimmed);
        } else if (trimmed === "!test") {
          reply = await handleTestCommand(jid);
        } else {
          reply = [
            "🤖 Unknown command.",
            "Available commands:",
            "• !verify <email>",
            "• !list",
            "• !delete",
            "• !cancel"
          ].join("\n");
          log.warn({ jid, command, messageId }, "Unknown command");
        }

        await socket.sendMessage(jid, { text: reply });
        log.info({ jid, command, messageId }, "Handled incoming command");
      } catch (err: unknown) {
        logError("Error handling incoming message", err, {
          jid,
          command,
          messageId
        });
      }
    }
  );
}
