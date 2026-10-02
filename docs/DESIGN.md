# Design Notes

## Architecture

Two independently runnable applications communicate over HTTP:

```
React + TypeScript frontend (Vite, port 5173)
        |
        | POST /v1/audiences/preview
        v
Express + TypeScript backend (port 3000)
        |
        v
     SQLite
```

The frontend owns form state and display logic. It never computes audience membership — it sends the full audience definition to the backend and renders whatever the backend returns. The backend owns query logic, time-window math, and condition evaluation. This makes each half independently testable and easy to reason about.

## Data model

A single `events` table stores all anonymous behavioral data:

```sql
events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  anonymous_id TEXT    NOT NULL,
  event_type   TEXT    NOT NULL,
  occurred_at  TEXT    NOT NULL   -- UTC ISO 8601, e.g. 2026-09-22T12:00:00.000Z
)
```

No personal data, credentials, or payment details are stored. All user identifiers are anonymous (`anon_001`, `anon_002`, …). Timestamps are stored as UTC ISO 8601 strings so that SQLite string comparison (`>=`, `<=`) produces correct chronological ordering, provided all timestamps use the same format.

Two composite indexes cover the evaluation query patterns:

- `(event_type, occurred_at)` — for filtering by type and window
- `(anonymous_id, event_type, occurred_at)` — for per-user aggregations

## Rule evaluation

The evaluator runs one SQL aggregation query per condition:

```sql
SELECT anonymous_id, COUNT(*) AS observed_count
  FROM events
 WHERE event_type  = ?
   AND occurred_at >= ?
   AND occurred_at <= ?
 GROUP BY anonymous_id;
```

The candidate user set comes from `SELECT DISTINCT anonymous_id FROM events`. Missing rows in a query result — a user who had zero events of the queried type — are treated as `observed_count = 0`. This is essential for `exactly 0` conditions to work correctly for users with no matching events.

The pure function `evaluateCondition(observedCount, operator, targetCount)` handles operator semantics in isolation:

- `at_least` → `observedCount >= targetCount`
- `exactly` → `observedCount === targetCount`

All conditions are combined with AND: a user must satisfy every condition.

A subtle consequence: a user with no events at all will not appear as a candidate and therefore cannot match any audience, even one made entirely of `exactly 0` conditions. This is documented in the seed data comments.

## Time-window decision

The window is **inclusive on both ends**: `[asOf - withinDays, asOf]`.

An event at exactly the window start timestamp is included. An event one second before is excluded. An event at `asOf` is included. An event after `asOf` is excluded — the preview is always evaluated as of a fixed point in time, never against the server's current clock.

Both edges are covered by dedicated tests. The seed data includes a user (`anon_006`) with a product view exactly at the window start, and a user (`anon_007`) with views one second before the start, to make boundary behavior concrete and observable.

`asOf` timestamps are normalized to UTC ISO format using `new Date(asOf).toISOString()` before comparison. This ensures that requests with timezone offsets (e.g., `+05:30`) produce the same window boundaries as equivalent UTC values, since the seed data is stored in UTC format.

## Validation

Zod validates all requests at the HTTP boundary before any database query runs. Validated fields include:

- `name`: required, non-empty, max 100 characters
- `asOf`: valid ISO 8601 datetime (offsets allowed)
- `conditions`: 1–10 items; each with a valid event type enum, operator enum, `count` (integer, 0–1,000,000), and `withinDays` (integer, 1–365)

Malformed JSON bodies are caught by an Express error handler and returned as a `INVALID_JSON` error in the same JSON envelope as all other errors.

## Scaling and trade-offs

**Current approach**: one SQL aggregation per condition, evaluated at request time against a local SQLite file. This is correct and fast at small scale.

**Realistic trade-off**: as event volume grows into the billions, per-request SQL aggregations become too slow. The practical solution is to precompute daily or hourly aggregate snapshots (e.g., `user_event_counts(anonymous_id, event_type, date, count)`) and query those instead of the raw event log. This trades query freshness for query speed. A columnar store (BigQuery, ClickHouse, Redshift) or a time-series database would further improve aggregation throughput. The `asOf` design already supports this: any precomputed snapshot store can be queried with the same `asOf` boundary to produce reproducible results.

`better-sqlite3` was chosen over Node's experimental `node:sqlite` for reliability and wider ecosystem support. Its synchronous API is appropriate here — SQLite queries are fast and there is no concurrency concern in a single-process backend. Reviewers need Python 3, `make`, and `g++` available for the native build step; this is called out in the README.
