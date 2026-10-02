import { Db } from "../db/database.js";
import { ValidatedAudienceRequest } from "../schemas/audience.js";
import {
  AudienceMember,
  AudiencePreviewResponse,
  EvidenceItem,
} from "../types/audience.js";
import { evaluateCondition } from "./evaluator.js";

interface EventCountRow {
  anonymous_id: string;
  observed_count: number;
}

interface AnonymousIdRow {
  anonymous_id: string;
}

/**
 * Evaluates an audience segment definition against historical event logs.
 *
 * Execution strategy:
 * 1. Collect all distinct anonymous users as candidate targets.
 * 2. Execute one SQL aggregation per condition over its specified time window.
 * 3. Map count results per user in memory (missing records default to 0 count).
 * 4. Filter candidates using AND logic across all conditions while collecting evidence.
 */
export function evaluateAudience(
  db: Db,
  request: ValidatedAudienceRequest
): AudiencePreviewResponse {
  const asOfDate = new Date(request.asOf);

  // Standardize asOf to UTC ISO string for deterministic comparison in SQLite
  const windowEnd = asOfDate.toISOString();

  // Distinct list of candidate anonymous users
  const allUsers = (
    db
      .prepare("SELECT DISTINCT anonymous_id FROM events")
      .all() as AnonymousIdRow[]
  ).map((row) => row.anonymous_id);

  // Aggregate event counts per user for each condition within its time window
  const conditionCounts: Map<string, number>[] = request.conditions.map((condition) => {
    const windowStart = new Date(
      asOfDate.getTime() - condition.withinDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const rows = db
      .prepare(
        `SELECT anonymous_id, COUNT(*) AS observed_count
           FROM events
          WHERE event_type  = ?
            AND occurred_at >= ?
            AND occurred_at <= ?
          GROUP BY anonymous_id`
      )
      .all(condition.eventType, windowStart, windowEnd) as EventCountRow[];

    const countByUser = new Map<string, number>();
    for (const row of rows) {
      countByUser.set(row.anonymous_id, row.observed_count);
    }
    return countByUser;
  });

  // Filter candidate pool against all conditions (AND semantics) and collect evidence
  const members: AudienceMember[] = [];

  for (const userId of allUsers) {
    let satisfiesAll = true;
    const evidence: EvidenceItem[] = [];

    for (let i = 0; i < request.conditions.length; i++) {
      const condition = request.conditions[i];
      const observedCount = conditionCounts[i].get(userId) ?? 0;

      evidence.push({ eventType: condition.eventType, observedCount });

      if (!evaluateCondition(observedCount, condition.operator, condition.count)) {
        satisfiesAll = false;
        // Keep accumulating evidence for all conditions to return complete member details
      }
    }

    if (satisfiesAll) {
      members.push({ anonymousId: userId, evidence });
    }
  }

  return {
    name: request.name,
    asOf: request.asOf,
    total: members.length,
    members,
  };
}
