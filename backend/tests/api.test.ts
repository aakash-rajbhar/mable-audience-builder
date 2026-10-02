import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { openInMemoryDatabase } from "../src/db/database.js";
import { createApp } from "../src/app.js";
import type { Db } from "../src/db/database.js";
import type { Application } from "express";

/**
 * Integration test suite for the audience evaluation API endpoints.
 * Uses isolated in-memory SQLite instances per test run.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function insertEvent(
  db: Db,
  anonymousId: string,
  eventType: string,
  occurredAt: string
): void {
  db.prepare(
    "INSERT INTO events (anonymous_id, event_type, occurred_at) VALUES (?, ?, ?)"
  ).run(anonymousId, eventType, occurredAt);
}

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------

describe("GET /health", () => {
  let app: Application;

  beforeEach(() => {
    const db = openInMemoryDatabase();
    app = createApp(db);
  });

  it("returns 200 with { status: 'ok' }", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

// ---------------------------------------------------------------------------
// Validation — request shape
// ---------------------------------------------------------------------------

describe("POST /v1/audiences/preview — request validation", () => {
  let app: Application;

  beforeEach(() => {
    const db = openInMemoryDatabase();
    app = createApp(db);
  });

  it("rejects a request with a missing name", async () => {
    const res = await request(app)
      .post("/v1/audiences/preview")
      .send({
        asOf: "2026-09-29T00:00:00.000Z",
        conditions: [{ eventType: "product_view", operator: "at_least", count: 1, withinDays: 7 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid eventType", async () => {
    const res = await request(app)
      .post("/v1/audiences/preview")
      .send({
        name: "Test",
        asOf: "2026-09-29T00:00:00.000Z",
        conditions: [{ eventType: "click", operator: "at_least", count: 1, withinDays: 7 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid operator", async () => {
    const res = await request(app)
      .post("/v1/audiences/preview")
      .send({
        name: "Test",
        asOf: "2026-09-29T00:00:00.000Z",
        conditions: [{ eventType: "product_view", operator: "more_than", count: 1, withinDays: 7 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a negative count", async () => {
    const res = await request(app)
      .post("/v1/audiences/preview")
      .send({
        name: "Test",
        asOf: "2026-09-29T00:00:00.000Z",
        conditions: [{ eventType: "product_view", operator: "at_least", count: -1, withinDays: 7 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a zero withinDays", async () => {
    const res = await request(app)
      .post("/v1/audiences/preview")
      .send({
        name: "Test",
        asOf: "2026-09-29T00:00:00.000Z",
        conditions: [{ eventType: "product_view", operator: "at_least", count: 1, withinDays: 0 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects withinDays exceeding 365 with specific error detail", async () => {
    const res = await request(app)
      .post("/v1/audiences/preview")
      .send({
        name: "Test",
        asOf: "2026-09-29T00:00:00.000Z",
        conditions: [{ eventType: "product_view", operator: "at_least", count: 1, withinDays: 400 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "conditions.0.withinDays",
          message: "withinDays must be <= 365",
        }),
      ])
    );
  });

  it("rejects an invalid asOf value", async () => {
    const res = await request(app)
      .post("/v1/audiences/preview")
      .send({
        name: "Test",
        asOf: "not-a-date",
        conditions: [{ eventType: "product_view", operator: "at_least", count: 1, withinDays: 7 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an empty conditions array", async () => {
    const res = await request(app)
      .post("/v1/audiences/preview")
      .send({ name: "Test", asOf: "2026-09-29T00:00:00.000Z", conditions: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects malformed JSON with code INVALID_JSON", async () => {
    const res = await request(app)
      .post("/v1/audiences/preview")
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/v1/unknown");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// Audience evaluation — operator behaviour
// ---------------------------------------------------------------------------

describe("POST /v1/audiences/preview — audience evaluation", () => {
  let db: Db;
  let app: Application;

  const AS_OF = "2026-09-29T00:00:00.000Z";
  // Window: [2026-09-22T00:00:00.000Z, 2026-09-29T00:00:00.000Z]
  const INSIDE  = "2026-09-25T12:00:00.000Z"; // comfortably inside window
  const START   = "2026-09-22T00:00:00.000Z"; // exactly at window start
  const BEFORE  = "2026-09-21T23:59:59.000Z"; // one second before window start
  const AFTER   = "2026-09-29T00:00:01.000Z"; // one second after asOf

  beforeEach(() => {
    db = openInMemoryDatabase();
    app = createApp(db);
  });

  const preview = (conditions: object[]) =>
    request(app)
      .post("/v1/audiences/preview")
      .send({ name: "Test", asOf: AS_OF, conditions });

  it("at_least passes when observed count equals the threshold", async () => {
    insertEvent(db, "user_a", "product_view", INSIDE);
    insertEvent(db, "user_a", "product_view", INSIDE);

    const res = await preview([{ eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 }]);
    expect(res.status).toBe(200);
    const member = res.body.members.find((m: { anonymousId: string }) => m.anonymousId === "user_a");
    expect(member).toBeDefined();
    expect(member.evidence[0].observedCount).toBe(2);
  });

  it("at_least passes when observed count exceeds the threshold", async () => {
    insertEvent(db, "user_b", "product_view", INSIDE);
    insertEvent(db, "user_b", "product_view", INSIDE);
    insertEvent(db, "user_b", "product_view", INSIDE);

    const res = await preview([{ eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 }]);
    expect(res.status).toBe(200);
    const member = res.body.members.find((m: { anonymousId: string }) => m.anonymousId === "user_b");
    expect(member).toBeDefined();
  });

  it("at_least fails when observed count is below the threshold", async () => {
    insertEvent(db, "user_c", "product_view", INSIDE);

    const res = await preview([{ eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 }]);
    expect(res.status).toBe(200);
    const member = res.body.members.find((m: { anonymousId: string }) => m.anonymousId === "user_c");
    expect(member).toBeUndefined();
  });

  it("exactly passes when observed count equals the threshold", async () => {
    insertEvent(db, "user_d", "purchase", INSIDE);

    const res = await preview([{ eventType: "purchase", operator: "exactly", count: 1, withinDays: 7 }]);
    expect(res.status).toBe(200);
    const member = res.body.members.find((m: { anonymousId: string }) => m.anonymousId === "user_d");
    expect(member).toBeDefined();
  });

  it("exactly fails when observed count differs", async () => {
    insertEvent(db, "user_e", "purchase", INSIDE);
    insertEvent(db, "user_e", "purchase", INSIDE);

    const res = await preview([{ eventType: "purchase", operator: "exactly", count: 1, withinDays: 7 }]);
    expect(res.status).toBe(200);
    const member = res.body.members.find((m: { anonymousId: string }) => m.anonymousId === "user_e");
    expect(member).toBeUndefined();
  });

  it("exactly 0 works for a user with no purchase rows", async () => {
    // user_f has no events at all but should still be found as a candidate
    // via the DISTINCT query if they have any other events.
    insertEvent(db, "user_f", "page_view", INSIDE);

    const res = await preview([{ eventType: "purchase", operator: "exactly", count: 0, withinDays: 7 }]);
    expect(res.status).toBe(200);
    const member = res.body.members.find((m: { anonymousId: string }) => m.anonymousId === "user_f");
    expect(member).toBeDefined();
    expect(member.evidence[0].observedCount).toBe(0);
  });

  it("AND semantics: user must satisfy every condition", async () => {
    insertEvent(db, "user_g", "product_view", INSIDE);
    insertEvent(db, "user_g", "product_view", INSIDE);
    insertEvent(db, "user_g", "purchase",     INSIDE); // disqualifier

    const res = await preview([
      { eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 },
      { eventType: "purchase",     operator: "exactly",  count: 0, withinDays: 7 },
    ]);
    expect(res.status).toBe(200);
    const member = res.body.members.find((m: { anonymousId: string }) => m.anonymousId === "user_g");
    expect(member).toBeUndefined();
  });

  it("events outside the time window are ignored", async () => {
    insertEvent(db, "user_h", "product_view", BEFORE);
    insertEvent(db, "user_h", "product_view", BEFORE);

    const res = await preview([{ eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 }]);
    expect(res.status).toBe(200);
    const member = res.body.members.find((m: { anonymousId: string }) => m.anonymousId === "user_h");
    expect(member).toBeUndefined();
  });

  it("event exactly at the window start is included", async () => {
    insertEvent(db, "user_i", "product_view", START);
    insertEvent(db, "user_i", "product_view", INSIDE);

    const res = await preview([{ eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 }]);
    expect(res.status).toBe(200);
    const member = res.body.members.find((m: { anonymousId: string }) => m.anonymousId === "user_i");
    expect(member).toBeDefined();
  });

  it("event one second before the window start is excluded", async () => {
    insertEvent(db, "user_j", "product_view", BEFORE);
    insertEvent(db, "user_j", "product_view", INSIDE); // only 1 inside → fails at_least 2

    const res = await preview([{ eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 }]);
    expect(res.status).toBe(200);
    const member = res.body.members.find((m: { anonymousId: string }) => m.anonymousId === "user_j");
    expect(member).toBeUndefined();
  });

  it("event after asOf is excluded (future events are not counted)", async () => {
    insertEvent(db, "user_k", "product_view", INSIDE);
    insertEvent(db, "user_k", "product_view", AFTER); // after asOf → excluded

    // Only 1 event inside window → fails at_least 2
    const res = await preview([{ eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 }]);
    expect(res.status).toBe(200);
    const member = res.body.members.find((m: { anonymousId: string }) => m.anonymousId === "user_k");
    expect(member).toBeUndefined();
  });

  it("asOf produces deterministic results regardless of server clock", async () => {
    insertEvent(db, "user_l", "product_view", INSIDE);
    insertEvent(db, "user_l", "product_view", INSIDE);

    // Run the same request twice — results must be identical.
    const resA = await preview([{ eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 }]);
    const resB = await preview([{ eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 }]);

    expect(resA.body.total).toBe(resB.body.total);
    expect(resA.body.members).toEqual(resB.body.members);
  });

  it("at_least 0 matches everyone with any event", async () => {
    insertEvent(db, "user_m", "page_view", INSIDE);

    const res = await preview([{ eventType: "product_view", operator: "at_least", count: 0, withinDays: 7 }]);
    expect(res.status).toBe(200);
    const member = res.body.members.find((m: { anonymousId: string }) => m.anonymousId === "user_m");
    expect(member).toBeDefined();
  });

  it("returns response with correct shape", async () => {
    insertEvent(db, "user_n", "product_view", INSIDE);
    insertEvent(db, "user_n", "product_view", INSIDE);

    const res = await preview([{ eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 }]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Test",
      asOf: AS_OF,
      total: expect.any(Number),
      members: expect.any(Array),
    });
    const member = res.body.members.find((m: { anonymousId: string }) => m.anonymousId === "user_n");
    expect(member.evidence).toEqual([
      { eventType: "product_view", observedCount: 2 },
    ]);
  });
});
