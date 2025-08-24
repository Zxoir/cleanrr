import { Redis } from "ioredis";

// Make your own small connection (safer than sharing BullMQ's)
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

export type DeleteContext = {
  kind: "delete-movie";
  userId: number;
  movie: { id: number; title: string; mediaType: "movie" | "tv" };
};

type Stored = { jid: string; context: DeleteContext };

const TTL_SEC = 5 * 60;
const keyMsg = (id: string) => `bot:confirm:msg:${id}`;
const keyJid = (jid: string) => `bot:confirm:last:${jid}`;

/** Save a pending confirmation, accessible by message id & by jid (last). */
export async function savePending(
  confirmMsgId: string,
  jid: string,
  context: DeleteContext
) {
  const value = JSON.stringify({ jid, context } satisfies Stored);
  await redis
    .multi()
    .set(keyMsg(confirmMsgId), value, "EX", TTL_SEC)
    .set(keyJid(jid), confirmMsgId, "EX", TTL_SEC)
    .exec();
}

/** Fetch by confirmation message id (no delete). */
export async function peekByMsgId(confirmMsgId: string | undefined | null) {
  if (!confirmMsgId) return null;
  const raw = await redis.get(keyMsg(confirmMsgId));
  if (!raw) return null;
  const stored = JSON.parse(raw) as Stored;
  return { confirmMsgId, ...stored };
}

/** Fetch the last pending for this jid (no delete). */
export async function peekLastForJid(jid: string) {
  const id = await redis.get(keyJid(jid));
  return id ? peekByMsgId(id) : null;
}

/** Clear a pending confirmation (idempotent). */
export async function clearPending(confirmMsgId: string, jid: string) {
  const pipe = redis.multi().del(keyMsg(confirmMsgId));
  // Only clear the "last" pointer if it points at the same id
  const last = await redis.get(keyJid(jid));
  if (last === confirmMsgId) pipe.del(keyJid(jid));
  await pipe.exec();
}
