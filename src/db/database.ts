import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  if (dbPath !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  db.exec("PRAGMA busy_timeout = 5000;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'RECEIVED',
      category TEXT,
      department TEXT,
      urgency TEXT,
      confidence REAL,
      suggested_reply TEXT,
      reasoning TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
  `);

  return db;
}
