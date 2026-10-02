import { Operator } from "../types/audience.js";

/**
 * Evaluates whether an observed event count satisfies a target operator threshold.
 */
export function evaluateCondition(
  observedCount: number,
  operator: Operator,
  targetCount: number
): boolean {
  switch (operator) {
    case "at_least":
      return observedCount >= targetCount;
    case "exactly":
      return observedCount === targetCount;
  }
}
