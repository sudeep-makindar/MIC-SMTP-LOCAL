import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { DATABASE_DIR, ensureDataDirs } from "../lib/paths";
import { SCHEMA_SQL } from "./schema";

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return db;
}

export function initDb(): DatabaseSync {
  ensureDataDirs();
  const dbPath = path.join(DATABASE_DIR, "app.db");
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_SQL);
  runMigrations(db);
  return db;
}

/**
 * CREATE TABLE IF NOT EXISTS only helps on a brand-new database — an
 * existing app.db from an earlier version won't pick up new columns added
 * to schema.ts. This adds any columns that are missing on an existing
 * install, so upgrades never require a manual reset.
 */
function runMigrations(database: DatabaseSync): void {
  addColumnIfMissing(database, "campaigns", "cc_emails", "TEXT DEFAULT ''");
  addColumnIfMissing(database, "campaigns", "bcc_emails", "TEXT DEFAULT ''");
  addColumnIfMissing(database, "campaigns", "reply_to", "TEXT DEFAULT ''");
}

function addColumnIfMissing(database: DatabaseSync, table: string, column: string, definition: string): void {
  const existing = database.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
  if (existing.some((c) => c.name === column)) return;
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/** node:sqlite has no built-in transaction() helper (unlike better-sqlite3), so this wraps BEGIN/COMMIT/ROLLBACK. */
export function withTransaction<T>(fn: () => T): T {
  const database = getDb();
  database.exec("BEGIN");
  try {
    const result = fn();
    database.exec("COMMIT");
    return result;
  } catch (err) {
    database.exec("ROLLBACK");
    throw err;
  }
}
