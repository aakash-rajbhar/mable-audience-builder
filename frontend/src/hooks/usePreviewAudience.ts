import { useState, useRef, useCallback, useEffect } from "react";
import type {
  ConditionRow,
  AudiencePreviewResponse,
} from "../types/audience";
import { previewAudience, ApiError, NetworkError } from "../api/audienceApi";

export type AppState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; result: AudiencePreviewResponse }
  | {
      kind: "error";
      message: string;
      details?: string[];
      isValidation: boolean;
    };

interface LastRequest {
  name: string;
  asOf: string;
  conditions: ConditionRow[];
}

/**
 * Custom hook managing audience preview request lifecycle,
 * server state machine, AbortController cancellation, retry, and error mapping.
 */
export function usePreviewAudience() {
  const [appState, setAppState] = useState<AppState>({ kind: "idle" });

  // Cache last submitted payload for retry functionality
  const lastRequestRef = useRef<LastRequest | null>(null);

  // Controller for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Container ref for accessibility focus management on results
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  // Abort any inflight request when unmounting
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const submitPreview = useCallback(
    async (
      submittedName: string,
      submittedAsOf: string,
      submittedConditions: ConditionRow[],
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

  const retry = useCallback(async () => {
    const last = lastRequestRef.current;
    if (!last) return;
    await submitPreview(last.name, last.asOf, last.conditions);
  }, [submitPreview]);

  return {
    appState,
    submitPreview,
    retry,
    resultsSectionRef,
    isLoading: appState.kind === "loading",
  };
}
