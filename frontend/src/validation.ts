import type { ConditionRow, FormValidationError } from "./types/audience";

/**
 * Combines date and time strings into a UTC ISO 8601 timestamp.
 */
export function buildUtcIso(date: string, time: string): string {
  return `${date}T${time}:00.000Z`;
}

/**
 * Validates audience builder form inputs prior to API submission.
 */
export function validateForm(
  name: string,
  date: string,
  conditions: ConditionRow[],
): FormValidationError[] {
  const errors: FormValidationError[] = [];

  if (!name.trim()) {
    errors.push({ field: "name", message: "Audience name is required." });
  }

  if (!date.trim()) {
    errors.push({ field: "asOf", message: "As-of date is required." });
  }

  conditions.forEach((c, i) => {
    if (
      isNaN(c.count) ||
      !Number.isInteger(c.count) ||
      c.count < 0 ||
      c.count > 1_000_000
    ) {
      errors.push({
        field: `conditions.${i}.count`,
        message: `Condition ${i + 1}: count must be an integer between 0 and 1,000,000.`,
      });
    }
    if (
      isNaN(c.withinDays) ||
      !Number.isInteger(c.withinDays) ||
      c.withinDays < 1 ||
      c.withinDays > 365
    ) {
      errors.push({
        field: `conditions.${i}.withinDays`,
        message: `Condition ${i + 1}: within days must be an integer between 1 and 365.`,
      });
    }
  });

  return errors;
}
