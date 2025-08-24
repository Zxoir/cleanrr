import express, { type Request, type Response } from "express";
import type { IncomingMessage, ServerResponse, Server } from "http";
import { pinoHttp } from "pino-http";
import { randomUUID } from "crypto";
import { z } from "zod";
import { config } from "./config.js";
import { createRequest } from "./db/requests.js";
import { logger } from "./utils/logger.js";
import { scheduleReminderAt } from "./jobs/queue.js";
import { getUserByEmail } from "./db/users.js";

const overseerrPayload = z.object({
  notification_type: z.string(),
  subject: z.string(),
  request: z.object({
    request_id: z.coerce.number(),
    requestedBy_email: z.email()
  }),
  media: z.object({
    media_type: z.enum(["movie", "tv"]),
    tvdbId: z.coerce.number().optional().default(0),
    tmdbId: z.coerce.number().optional().default(0)
  })
});

export function startWebhookServer(): Server {
  const app = express();
  const port = config.port;

  app.use(
    pinoHttp({
      logger,
      genReqId: (req: IncomingMessage) =>
        (req.headers["x-request-id"] as string) ?? randomUUID(),
      customLogLevel(_req: IncomingMessage, res: ServerResponse, err?: Error) {
        if (err) return "error";
        if (res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      }
    })
  );

  app.use(express.json({ limit: "100kb" }));

  app.post("/overseerr", async (req: Request, res: Response) => {
    const log = logger.child({ reqId: randomUUID(), route: "overseerr" });

    const sig = req.get("x-request-id");
    if (
      config.overseerr.webhookSecret &&
      sig !== config.overseerr.webhookSecret
    ) {
      log.warn("Unauthorized webhook (bad signature)");
      return res.status(401).send("unauthorized");
    }

    console.log(req.body);

    try {
      const payload = overseerrPayload.parse(req.body);
      const { media, request, subject, notification_type } = payload;

      if (
        notification_type !== "MEDIA_AUTO_APPROVED" &&
        notification_type !== "MEDIA_APPROVED"
      ) {
        return res.status(200).send("ignored");
      }

      const user = await getUserByEmail(request.requestedBy_email);
      if (!user) {
        log.warn({ email: request.requestedBy_email }, "User not linked");
        return res.status(200).send("user not linked");
      }

      const isTv = media.media_type === "tv";
      const dueAtMs =
        Date.now() + (isTv ? config.showDelayMs : config.movieDelayMs);

      const createdId = await createRequest({
        email: user.email,
        title: subject,
        type: isTv ? "tv" : "movie",
        mediaId: isTv ? media.tvdbId : media.tmdbId,
        dueAt: dueAtMs
      });

      if (createdId !== null) {
        await scheduleReminderAt(user.id, createdId, dueAtMs);
      }

      log.info(
        {
          reqId: request.request_id,
          userId: user.id,
          type: media.media_type,
          title: subject
        },
        "Scheduled reminder"
      );
      return res.status(200).send("ok");
    } catch (err: unknown) {
      if (err instanceof Error) {
        log.error({ err }, "Webhook handler error");
      } else {
        log.error({ err: String(err) }, "Webhook handler error");
      }
      return res.status(400).send("bad request");
    }
  });

  app.get("/health", (_req: Request, res: Response) =>
    res.json({ ok: true, uptimeMs: Math.round(process.uptime() * 1000) })
  );

  const server = app.listen(port, () => {
    logger.info(`Webhook server listening on port ${port}`);
  });
  return server;
}
