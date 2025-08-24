import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";
import path from "node:path";
import fs from "node:fs";
import { logger, logError } from "../utils/logger.js";

let dbInstance: Database | null = null;
const log = logger.child({ ctx: "db.init" });

export async function initDatabase(): Promise<void> {
  try {
    const dbPath =
      process.env.DB_PATH ?? path.resolve(process.cwd(), "data/cleanrr.sqlite");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await db.exec("PRAGMA journal_mode = WAL;");
    await db.exec("PRAGMA foreign_keys = ON;");

    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL UNIQUE
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('movie','tv')),
        mediaId INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','cancelled','deleted')),
        requestedAt TEXT NOT NULL DEFAULT (datetime('now')),
        dueAt INTEGER NOT NULL,
        FOREIGN KEY(email) REFERENCES users(email)
      );
    `);

    // Migration: ensure dueAt exists and is populated
    const cols = await db.all<{ name: string }[]>(
      "PRAGMA table_info('requests');"
    );
    const hasDueAt = cols.some((c) => c.name === "dueAt");
    if (!hasDueAt) {
      await db.exec(`ALTER TABLE requests ADD COLUMN dueAt INTEGER;`);
      log.info("Migrated: added dueAt to requests");
      // Best-effort backfill with movie 3d / tv 5d defaults
      await db.exec(`
        UPDATE requests
        SET dueAt = CAST(strftime('%s', requestedAt) AS INTEGER) * 1000 + 3*86400000
        WHERE type='movie' AND (dueAt IS NULL OR dueAt = 0);
      `);
      await db.exec(`
        UPDATE requests
        SET dueAt = CAST(strftime('%s', requestedAt) AS INTEGER) * 1000 + 5*86400000
        WHERE type='tv' AND (dueAt IS NULL OR dueAt = 0);
      `);
    }

    // Idempotency: prevent duplicate pending tracking for same user/media
    await db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_unique_pending
      ON requests (email, type, mediaId)
      WHERE status = 'pending';
    `);

    dbInstance = db;
    log.info({ dbPath }, "Database initialized");
  } catch (err: unknown) {
    logError("Failed to initialize database", err);
    throw err;
  }
}

export function getDb(): Database {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return dbInstance;
}
