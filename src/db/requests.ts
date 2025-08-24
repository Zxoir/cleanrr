import { getDb } from "./init.js";
import { logger, logError } from "../utils/logger.js";

export interface MediaRequest {
  id: number;
  email: string;
  title: string;
  type: "movie" | "tv";
  mediaId: number;
  status: "pending" | "cancelled" | "deleted";
  requestedAt: string; // ISO
  dueAt: number; // epoch ms
}

const log = logger.child({ ctx: "db.requests" });

export async function createRequest(input: {
  email: string;
  title: string;
  type: "movie" | "tv";
  mediaId: number;
  dueAt: number;
}): Promise<number | null> {
  try {
    const db = getDb();
    const res = await db.run(
      `
      INSERT OR IGNORE INTO requests (email, title, type, mediaId, status, requestedAt, dueAt)
      VALUES (?, ?, ?, ?, 'pending', datetime('now'), ?)
      `,
      [input.email, input.title, input.type, input.mediaId, input.dueAt]
    );
    if (!res.lastID) {
      log.info(
        { email: input.email, type: input.type, mediaId: input.mediaId },
        "Request ignored (duplicate pending)"
      );
      return null;
    }
    log.info({ id: res.lastID }, "Created request");
    return res.lastID!;
  } catch (err: unknown) {
    logError("createRequest failed", err, {
      email: input.email,
      mediaId: input.mediaId
    });
    throw err;
  }
}

export async function getPendingRequestsForUser(
  email: string
): Promise<MediaRequest[]> {
  try {
    const db = getDb();
    return await db.all<MediaRequest[]>(
      `
      SELECT id, email, title, type, mediaId, status, requestedAt, dueAt
      FROM requests
      WHERE email = ? AND status = 'pending'
      ORDER BY dueAt ASC
      `,
      [email]
    );
  } catch (err: unknown) {
    logError("getPendingRequestsForUser failed", err, { email });
    return [];
  }
}

export async function markRequestAsCancelled(id: number): Promise<void> {
  try {
    const db = getDb();
    await db.run(`UPDATE requests SET status = 'cancelled' WHERE id = ?`, [id]);
    log.info({ requestId: id }, "Marked request as cancelled");
  } catch (err: unknown) {
    logError("markRequestAsCancelled failed", err, { requestId: id });
    throw err;
  }
}

export async function markRequestAsDeleted(id: number): Promise<void> {
  try {
    const db = getDb();
    await db.run(`UPDATE requests SET status = 'deleted' WHERE id = ?`, [id]);
    log.info({ requestId: id }, "Marked request as deleted");
  } catch (err: unknown) {
    logError("markRequestAsDeleted failed", err, { requestId: id });
    throw err;
  }
}
