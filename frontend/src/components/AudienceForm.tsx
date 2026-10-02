import { useState, useRef, useCallback } from "react";
import type {
  ConditionRow as ConditionRowType,
  AudiencePreviewResponse,
  FormValidationError,
} from "../types/audience";
import { previewAudience, ApiError, NetworkError } from "../api/audienceApi";
import { ConditionRow } from "./ConditionRow";
import { AudienceResults } from "./AudienceResults";

// Seed defaults matching test scenario
const DEFAULT_DATE = "2026-09-29";
const DEFAULT_TIME = "00:00";

/**
 * Combines date and time strings into a UTC ISO 8601 timestamp.
 */
function buildUtcIso(date: string, time: string): string {
  return `${date}T${time}:00.000Z`;
}

function makeConditionId(): string {
  return `cond_${Math.random().toString(36).slice(2, 9)}`;
}

function makeDefaultConditions(): ConditionRowType[] {
  return [
    {
      id: makeConditionId(),
      eventType: "product_view",
      operator: "at_least",
      count: 2,
      withinDays: 7,
    },
    {
      id: makeConditionId(),
      eventType: "purchase",
      operator: "exactly",
      count: 0,
      withinDays: 7,
    },
  ];
}

// ---------------------------------------------------------------------------
// Client Form Validation
// ---------------------------------------------------------------------------

function validateForm(
  name: string,
  date: string,
  conditions: ConditionRowType[],
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

// ---------------------------------------------------------------------------
// Component State & Types
// ---------------------------------------------------------------------------

type AppState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; result: AudiencePreviewResponse }
  | {
      kind: "error";
      message: string;
      details?: string[];
      isValidation: boolean;
    };

export function AudienceForm() {
  const [name, setName] = useState("Viewed but not purchased");
  const [asOfDate, setAsOfDate] = useState(DEFAULT_DATE);
  const [asOfTime, setAsOfTime] = useState(DEFAULT_TIME);
  const [conditions, setConditions] = useState<ConditionRowType[]>(
    makeDefaultConditions,
  );
  const [formErrors, setFormErrors] = useState<FormValidationError[]>([]);
  const [appState, setAppState] = useState<AppState>({ kind: "idle" });

  // Cache last submitted payload for retry
  const lastRequestRef = useRef<{
    name: string;
    asOf: string;
    conditions: ConditionRowType[];
  } | null>(null);

  // Controller for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Container ref for accessibility focus management
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  const addCondition = useCallback(() => {
    setConditions((prev) => [
      ...prev,
      {
        id: makeConditionId(),
        eventType: "page_view",
        operator: "at_least",
        count: 1,
        withinDays: 7,
      },
    ]);
  }, []);

  const removeCondition = useCallback((id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateCondition = useCallback(
    (id: string, updates: Partial<ConditionRowType>) => {
      setConditions((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      );
    },
    [],
  );

  const submitPreview = useCallback(
    async (
      submittedName: string,
      submittedAsOf: string,
      submittedConditions: ConditionRowType[],
    ) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setAppState({ kind: "loading" });
      lastRequestRef.current = {
        name: submittedName,
        asOf: submittedAsOf,
        conditions: submittedConditions,
      };

      try {
        const result = await previewAudience(
          {
            name: submittedName,
            asOf: submittedAsOf,
            conditions: submittedConditions.map(({ id: _id, ...rest }) => rest),
          },
          controller.signal,
        );
        setAppState({ kind: "success", result });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        if (err instanceof ApiError) {
          const details = err.body.error.details?.map(
            (d) => `${d.path ? d.path + ": " : ""}${d.message}`,
          );
          setAppState({
            kind: "error",
            message: err.body.error.message,
            details: details && details.length > 0 ? details : undefined,
            isValidation: err.body.error.code === "VALIDATION_ERROR",
          });
        } else if (err instanceof NetworkError) {
          setAppState({
            kind: "error",
            message: err.message,
            isValidation: false,
          });
        } else {
          setAppState({
            kind: "error",
            message: "An unexpected error occurred. Please try again.",
            isValidation: false,
          });
        }
      } finally {
        requestAnimationFrame(() => resultsSectionRef.current?.focus());
      }
    },
    [],
  );

  const handlePreview = useCallback(async () => {
    const errors = validateForm(name, asOfDate, conditions);
    setFormErrors(errors);
    if (errors.length > 0) return;
    await submitPreview(name, buildUtcIso(asOfDate, asOfTime), conditions);
  }, [name, asOfDate, asOfTime, conditions, submitPreview]);

  const handleRetry = useCallback(async () => {
    const last = lastRequestRef.current;
    if (!last) return;
    await submitPreview(last.name, last.asOf, last.conditions);
  }, [submitPreview]);

  const fieldError = (field: string) =>
    formErrors.find((e) => e.field === field)?.message;

  const isLoading = appState.kind === "loading";

  // Live preview of what will be sent to the API
  const utcPreview = asOfDate ? buildUtcIso(asOfDate, asOfTime || "00:00") : "";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 pb-20 pt-8">
      {/* Header */}
      <header className="mb-10 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">
          Audience Builder
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Define conditions to preview a matching audience from anonymous event
          data.
        </p>
      </header>

      <main className="flex flex-col gap-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handlePreview();
          }}
          noValidate
          aria-label="Audience definition form"
          className="flex flex-col gap-6"
        >
          {/* Audience name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="audience-name"
              className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
            >
              Audience name
            </label>
            <input
              id="audience-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              aria-required="true"
              aria-describedby={fieldError("name") ? "name-error" : undefined}
              aria-invalid={!!fieldError("name")}
              disabled={isLoading}
              className={fieldError("name") ? "border-border-error" : ""}
            />
            {fieldError("name") && (
              <span
                id="name-error"
                role="alert"
                className="text-xs font-medium text-error"
              >
                {fieldError("name")}
              </span>
            )}
          </div>

          {/* As-of: date + time */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              As of{" "}
              <span className="font-normal normal-case tracking-normal text-text-hint">
                : events are evaluated up to this UTC moment
              </span>
            </label>

            <div className="flex flex-wrap gap-3">
              {/* Date picker */}
              <div className="flex flex-1 flex-col gap-1 min-w-40">
                <label htmlFor="as-of-date" className="text-xs text-text-hint">
                  Date
                </label>
                <input
                  id="as-of-date"
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  aria-required="true"
                  aria-describedby={
                    fieldError("asOf") ? "as-of-error" : "as-of-hint"
                  }
                  aria-invalid={!!fieldError("asOf")}
                  disabled={isLoading}
                  className={fieldError("asOf") ? "border-border-error" : ""}
                />
              </div>

              {/* Time picker */}
              <div className="flex w-36 shrink-0 flex-col gap-1">
                <label htmlFor="as-of-time" className="text-xs text-text-hint">
                  Time (UTC)
                </label>
                <input
                  id="as-of-time"
                  type="time"
                  value={asOfTime}
                  onChange={(e) => setAsOfTime(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Live UTC preview */}
            <p id="as-of-hint" className="text-xs text-text-hint">
              Sends to API as{" "}
              <span className="font-mono text-text-secondary">
                {utcPreview || "YYYY-MM-DDT00:00:00.000Z"}
              </span>
            </p>

            {fieldError("asOf") && (
              <span
                id="as-of-error"
                role="alert"
                className="text-xs font-medium text-error"
              >
                {fieldError("asOf")}
              </span>
            )}
          </div>

          {/* Conditions */}
          <fieldset
            disabled={isLoading}
            className="rounded-xl border border-border p-5"
          >
            <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Conditions
            </legend>

            <p className="mb-4 mt-1 text-xs text-text-hint">
              All conditions are combined with{" "}
              <strong className="text-text-secondary">AND</strong>. A user must
              satisfy every condition to be included.
            </p>

            {/* Validation summary */}
            {formErrors.length > 0 && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 rounded-lg border border-border-error bg-error-bg p-4"
              >
                <p className="mb-1.5 text-sm font-semibold text-error">
                  Please fix the following issues:
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm text-text-secondary">
                  {formErrors.map((err) => (
                    <li key={`${err.field}-${err.message}`}>{err.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div
              role="list"
              aria-label="Audience conditions"
              className="flex flex-col gap-3"
            >
              {conditions.map((condition, index) => (
                <div key={condition.id} role="listitem">
                  <ConditionRow
                    condition={condition}
                    index={index}
                    isRemovable={conditions.length > 1}
                    onChange={updateCondition}
                    onRemove={removeCondition}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addCondition}
              aria-label="Add a new condition"
              className="mt-3 w-full rounded-lg border border-dashed border-border py-2 text-sm font-semibold text-accent transition-colors hover:border-accent hover:bg-warning-bg"
            >
              + Add condition
            </button>
          </fieldset>

          {/* Submit */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="rounded-lg bg-accent px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Previewing…" : "Preview audience"}
            </button>
          </div>
        </form>

        {/* Results / status area */}
        <div
          ref={resultsSectionRef}
          tabIndex={-1}
          aria-live="polite"
          className="outline-none"
        >
          {appState.kind === "idle" && (
            <p className="py-2 text-sm text-text-hint">
              Fill in the form above and click{" "}
              <strong className="text-text-secondary">Preview audience</strong>{" "}
              to see which anonymous users match your conditions.
            </p>
          )}

          {appState.kind === "loading" && (
            <p className="animate-pulse-text py-2 text-sm text-text-secondary">
              Evaluating audience…
            </p>
          )}

          {appState.kind === "error" && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-error-bg bg-error-bg px-6 py-5"
            >
              <p className="text-sm font-bold text-error">
                {appState.isValidation ? "Validation error" : "Request failed"}
              </p>
              <p className="text-sm text-text-secondary">{appState.message}</p>
              {appState.details && appState.details.length > 0 && (
                <ul className="list-inside list-disc space-y-1 text-sm text-text-secondary">
                  {appState.details.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={handleRetry}
                aria-label="Retry the last audience preview"
                className="self-start rounded border border-error-bg px-4 py-1.5 text-xs font-semibold text-error transition-colors hover:bg-error-bg"
              >
                Retry
              </button>
            </div>
          )}

          {appState.kind === "success" && (
            <AudienceResults result={appState.result} />
          )}
        </div>
      </main>
    </div>
  );
}
