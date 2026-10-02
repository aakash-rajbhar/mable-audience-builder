import Database from "better-sqlite3";

export type Db = Database.Database;

/**
 * Opens SQLite connection and ensures base tables and indices are initialized.
 */
export function openDatabase(path: string): Db {
  const db = new Database(path);

  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      anonymous_id TEXT    NOT NULL,
      event_type   TEXT    NOT NULL,
      occurred_at  TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_type_time
      ON events(event_type, occurred_at);

    CREATE INDEX IF NOT EXISTS idx_events_user_type_time
      ON events(anonymous_id, event_type, occurred_at);
  `);

  return db;
}

/**
 * Instantiates an in-memory SQLite database instance (primarily for testing).
 */
export function openInMemoryDatabase(): Db {
  return openDatabase(":memory:");
}
