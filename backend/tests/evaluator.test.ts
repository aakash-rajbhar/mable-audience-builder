import { describe, it, expect } from "vitest";
import { evaluateCondition } from "../src/services/evaluator.js";

describe("evaluateCondition — at_least operator", () => {
  it("passes when observed count equals the threshold", () => {
    expect(evaluateCondition(2, "at_least", 2)).toBe(true);
  });

  it("passes when observed count exceeds the threshold", () => {
    expect(evaluateCondition(5, "at_least", 2)).toBe(true);
  });

  it("fails when observed count is below the threshold", () => {
    expect(evaluateCondition(1, "at_least", 2)).toBe(false);
  });

  it("passes when threshold is 0 (matches everyone)", () => {
    expect(evaluateCondition(0, "at_least", 0)).toBe(true);
    expect(evaluateCondition(3, "at_least", 0)).toBe(true);
  });
});

describe("evaluateCondition — exactly operator", () => {
  it("passes when observed count equals the threshold", () => {
    expect(evaluateCondition(0, "exactly", 0)).toBe(true);
    expect(evaluateCondition(2, "exactly", 2)).toBe(true);
  });

  it("fails when observed count is higher than the threshold", () => {
    expect(evaluateCondition(3, "exactly", 2)).toBe(false);
  });

  it("fails when observed count is lower than the threshold", () => {
    expect(evaluateCondition(1, "exactly", 2)).toBe(false);
  });
});
