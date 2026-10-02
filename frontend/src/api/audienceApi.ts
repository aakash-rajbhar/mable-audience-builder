import type {
  AudiencePreviewRequest,
  AudiencePreviewResponse,
  ApiErrorBody,
} from "../types/audience";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  public readonly status: number;
  public readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export class NetworkError extends Error {
  constructor(baseUrl: string) {
    super(`Cannot reach the backend at ${baseUrl}. Is it running?`);
    this.name = "NetworkError";
  }
}

/**
 * Submits an audience evaluation request to the backend service.
 */
export async function previewAudience(
  request: AudiencePreviewRequest,
  signal?: AbortSignal
): Promise<AudiencePreviewResponse> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}/v1/audiences/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    throw new NetworkError(BASE_URL);
  }

  if (!response.ok) {
    let errorBody: ApiErrorBody;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = {
        error: {
          code: "UNKNOWN_ERROR",
          message: `Unexpected server response (HTTP ${response.status})`,
        },
      };
    }
    throw new ApiError(response.status, errorBody);
  }

  return response.json() as Promise<AudiencePreviewResponse>;
}
