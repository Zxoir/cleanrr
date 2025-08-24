import { getDb } from "./init.js";
import { logger, logError } from "../utils/logger.js";

export interface User {
  id: number;
  email: string;
  phone: string;
}

const log = logger.child({ ctx: "db.users" });

export async function saveUserPhoneNumber(
  id: number,
  email: string,
  phone: string
): Promise<void> {
  try {
    const db = getDb();
    await db.run(
      `INSERT INTO users (id, email, phone)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET phone = excluded.phone`,
      [id, email, phone]
    );
    log.info({ userId: id }, "Linked JID to user");
  } catch (err: unknown) {
    logError("Failed to save user phone number", err, { userId: id });
    throw err;
  }
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  try {
    const db = getDb();
    return await db.get<User>(
      `SELECT id, email, phone FROM users WHERE email = ?`,
      [email]
    );
  } catch (err: unknown) {
    logError("getUserByPhone failed", err, { email: Boolean(email) });
    return undefined;
  }
}

export async function getUserByPhone(phone: string): Promise<User | undefined> {
  try {
    const db = getDb();
    return await db.get<User>(
      `SELECT id, email, phone FROM users WHERE phone = ?`,
      [phone]
    );
  } catch (err: unknown) {
    logError("getUserByPhone failed", err, { phoneMasked: Boolean(phone) });
    return undefined;
  }
}

export async function getUserById(id: number): Promise<User | undefined> {
  try {
    const db = getDb();
    return await db.get<User>(
      `SELECT id, email, phone FROM users WHERE id = ?`,
      [id]
    );
  } catch (err: unknown) {
    logError("getUserById failed", err, { userId: id });
    return undefined;
  }
}
