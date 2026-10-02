import { z } from "zod";

const conditionSchema = z.object({
  eventType: z.enum([
    "page_view",
    "product_view",
    "add_to_cart",
    "checkout_started",
    "purchase",
  ]),
  operator: z.enum(["at_least", "exactly"]),
  count: z
    .number()
    .int("count must be an integer")
    .min(0, "count must be >= 0")
    .max(1_000_000, "count must be <= 1,000,000"),
  withinDays: z
    .number()
    .int("withinDays must be an integer")
    .min(1, "withinDays must be >= 1")
    .max(365, "withinDays must be <= 365"),
});

export const audiencePreviewSchema = z.object({
  name: z
    .string()
    .min(1, "name must not be empty")
    .max(100, "name must be <= 100 characters")
    .transform((s) => s.trim()),
  asOf: z
    .string()
    .datetime({ offset: true, message: "asOf must be a valid ISO 8601 datetime" }),
  conditions: z
    .array(conditionSchema)
    .min(1, "at least one condition is required")
    .max(10, "at most 10 conditions are allowed"),
});

export type ValidatedAudienceRequest = z.infer<typeof audiencePreviewSchema>;
