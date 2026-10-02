export const EVENT_TYPES = [
  "page_view",
  "product_view",
  "add_to_cart",
  "checkout_started",
  "purchase",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const OPERATORS = ["at_least", "exactly"] as const;

export type Operator = (typeof OPERATORS)[number];

export interface Condition {
  eventType: EventType;
  operator: Operator;
  count: number;
  withinDays: number;
}

export interface AudiencePreviewRequest {
  name: string;
  asOf: string;
  conditions: Condition[];
}

export interface EvidenceItem {
  eventType: EventType;
  observedCount: number;
}

export interface AudienceMember {
  anonymousId: string;
  evidence: EvidenceItem[];
}

export interface AudiencePreviewResponse {
  name: string;
  asOf: string;
  total: number;
  members: AudienceMember[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}
