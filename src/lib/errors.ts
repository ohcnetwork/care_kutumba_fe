import { HttpError } from "@/lib/request";

/**
 * Shape of an error body the BE may return.
 *
 * Two known conventions:
 *  - 503 / upstream failure: `{ error: "...", request_log_external_id: "..." }`
 *  - 400 / Pydantic validation: `{ errors: [{ msg, loc, ... }] }`
 *
 * All fields are optional so the parser tolerates unexpected shapes.
 */
interface ErrorBody {
  error?: string;
  errors?: { msg?: string }[];
  request_log_external_id?: string;
}

export interface ParsedError {
  message: string;
  /** Optional support-correlation id (e.g. KutumbaRequestLog.external_id). */
  referenceId?: string;
}

const DEFAULT_FALLBACK = "Something went wrong. Please try again.";

/**
 * Best-effort extraction of a user-facing error message + reference id from a
 * failed request.
 *
 * Use this in the UI layer to render error banners from `useMutation.error`
 * or `useQuery.error` without having to know the exact response shape.
 *
 * Falls back to a generic message so we never render `undefined`.
 */
export function parseHttpError(
  err: unknown,
  fallback: string = DEFAULT_FALLBACK,
): ParsedError {
  if (!(err instanceof HttpError)) return { message: fallback };

  const cause = err.cause as ErrorBody | undefined;

  // Prefer explicit status-based handling first, then fallback to shape-based
  // handling for resilience against slight backend payload changes.

  // 503 / upstream failure: prefer BE-safe message + support correlation id.
  if (err.status === 503 && cause?.error) {
    return {
      message: cause.error,
      referenceId: cause.request_log_external_id,
    };
  }

  // 400 / Pydantic validation: join field-level messages.
  if (err.status === 400 && cause?.errors?.length) {
    const joined = cause.errors
      .map((e) => e.msg)
      .filter(Boolean)
      .join(", ");
    return { message: joined || fallback };
  }

  // Shape-based fallbacks (useful if status mapping changes upstream).
  if (cause?.error) {
    return {
      message: cause.error,
      referenceId: cause.request_log_external_id,
    };
  }

  if (cause?.errors?.length) {
    const joined = cause.errors
      .map((e) => e.msg)
      .filter(Boolean)
      .join(", ");
    return { message: joined || fallback };
  }

  return { message: fallback };
}
