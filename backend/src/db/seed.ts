import { Db } from "./database.js";

/**
 * Seed script for synthetic, anonymous event data.
 *
 * The reference scenario uses:
 *   asOf        = 2026-09-29T00:00:00.000Z
 *   withinDays  = 7
 *   window      = [2026-09-22T00:00:00.000Z, 2026-09-29T00:00:00.000Z]  (inclusive)
 *
 * User legend (expected outcome for the reference scenario):
 *
 *   anon_001  3 product_views in window, 0 purchases            → MATCH
 *   anon_002  2 product_views in window, 0 purchases            → MATCH
 *   anon_003  1 product_view  in window, 0 purchases            → NO MATCH (too few views)
 *   anon_004  5 product_views in window, 1 purchase in window   → NO MATCH (has a purchase)
 *   anon_005  0 product_views, only a page_view (different type)→ NO MATCH (too few views)
 *   anon_006  2 product_views: one AT the window start, one inside → MATCH (boundary inclusive)
 *   anon_007  2 product_views but BOTH just before the window   → NO MATCH (outside window)
 *   anon_008  1 product_view inside window + 1 purchase OUTSIDE → MATCH (out-of-window purchase ignored)
 *   anon_009  2 product_views inside window, 1 purchase AFTER asOf → MATCH (future purchase ignored)
 */
const EVENTS: Array<{ anonymous_id: string; event_type: string; occurred_at: string }> = [
  // anon_001 — clear positive match
  { anonymous_id: "anon_001", event_type: "product_view",  occurred_at: "2026-09-22T12:00:00.000Z" },
  { anonymous_id: "anon_001", event_type: "product_view",  occurred_at: "2026-09-24T08:00:00.000Z" },
  { anonymous_id: "anon_001", event_type: "product_view",  occurred_at: "2026-09-27T15:30:00.000Z" },
  { anonymous_id: "anon_001", event_type: "page_view",     occurred_at: "2026-09-28T10:00:00.000Z" },

  // anon_002 — matches exactly on minimum count
  { anonymous_id: "anon_002", event_type: "product_view",  occurred_at: "2026-09-23T09:00:00.000Z" },
  { anonymous_id: "anon_002", event_type: "product_view",  occurred_at: "2026-09-26T14:00:00.000Z" },

  // anon_003 — only one view; fails count condition
  { anonymous_id: "anon_003", event_type: "product_view",  occurred_at: "2026-09-25T11:00:00.000Z" },

  // anon_004 — enough views but has a purchase; fails purchase condition
  { anonymous_id: "anon_004", event_type: "product_view",  occurred_at: "2026-09-22T07:00:00.000Z" },
  { anonymous_id: "anon_004", event_type: "product_view",  occurred_at: "2026-09-23T07:00:00.000Z" },
  { anonymous_id: "anon_004", event_type: "product_view",  occurred_at: "2026-09-24T07:00:00.000Z" },
  { anonymous_id: "anon_004", event_type: "product_view",  occurred_at: "2026-09-25T07:00:00.000Z" },
  { anonymous_id: "anon_004", event_type: "product_view",  occurred_at: "2026-09-26T07:00:00.000Z" },
  { anonymous_id: "anon_004", event_type: "add_to_cart",   occurred_at: "2026-09-27T12:00:00.000Z" },
  { anonymous_id: "anon_004", event_type: "checkout_started", occurred_at: "2026-09-27T12:05:00.000Z" },
  { anonymous_id: "anon_004", event_type: "purchase",      occurred_at: "2026-09-28T08:00:00.000Z" },

  // anon_005 — no product_views at all (has a page_view so it exists in the table)
  { anonymous_id: "anon_005", event_type: "page_view",     occurred_at: "2026-09-25T10:00:00.000Z" },

  // anon_006 — boundary: first view is EXACTLY at window start (2026-09-22T00:00:00.000Z)
  { anonymous_id: "anon_006", event_type: "product_view",  occurred_at: "2026-09-22T00:00:00.000Z" },
  { anonymous_id: "anon_006", event_type: "product_view",  occurred_at: "2026-09-25T16:00:00.000Z" },

  // anon_007 — both views one second before the window start; should NOT match
  { anonymous_id: "anon_007", event_type: "product_view",  occurred_at: "2026-09-21T23:59:58.000Z" },
  { anonymous_id: "anon_007", event_type: "product_view",  occurred_at: "2026-09-21T23:59:59.000Z" },

  // anon_008 — one view inside window, purchase OUTSIDE window (before start); purchase must not count
  { anonymous_id: "anon_008", event_type: "product_view",  occurred_at: "2026-09-23T10:00:00.000Z" },
  { anonymous_id: "anon_008", event_type: "product_view",  occurred_at: "2026-09-26T10:00:00.000Z" },
  { anonymous_id: "anon_008", event_type: "purchase",      occurred_at: "2026-09-20T06:00:00.000Z" },

  // anon_009 — views inside window, purchase AFTER asOf (future); future purchase must not count
  { anonymous_id: "anon_009", event_type: "product_view",  occurred_at: "2026-09-24T11:00:00.000Z" },
  { anonymous_id: "anon_009", event_type: "product_view",  occurred_at: "2026-09-27T11:00:00.000Z" },
  { anonymous_id: "anon_009", event_type: "purchase",      occurred_at: "2026-09-30T09:00:00.000Z" },
];

export function seedDatabase(db: Db): void {
  const insert = db.prepare(
    "INSERT INTO events (anonymous_id, event_type, occurred_at) VALUES (?, ?, ?)"
  );

  const insertMany = db.transaction(() => {
    for (const event of EVENTS) {
      insert.run(event.anonymous_id, event.event_type, event.occurred_at);
    }
  });

  insertMany();
  console.log(`Seeded ${EVENTS.length} events into the database.`);
}

/**
 * Standalone entry point: run with `npx tsx src/db/seed.ts`
 */
if (require.main === module) {
  const path = require("path");
  const { openDatabase } = require("./database.js");
  const dbPath = process.env.DATABASE_PATH ?? path.join(__dirname, "../../data/events.db");
  const db = openDatabase(dbPath);
  seedDatabase(db);
  db.close();
}
