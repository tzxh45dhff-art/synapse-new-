/**
 * Typed HTTP client for communicating with the FastAPI backend.
 * All requests from Server Actions go through this module.
 * Automatically attaches the Supabase JWT as a Bearer token.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

/** Normal requests. A dead backend must fail fast, not hang forever. */
const DEFAULT_TIMEOUT_MS = 45_000;
/** Generation and chat routes legitimately take minutes. */
const AI_TIMEOUT_MS = 300_000;
const AI_ROUTES = /\/(generate|grade|chat|flashcards|notes|messages)\b/;

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string;
  timeoutMs?: number;
};

type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

/**
 * Turn a backend error payload into one readable sentence.
 *
 * FastAPI sends `detail` as a string for HTTPException but as a list of
 * objects for request-validation failures — rendering that raw is where
 * "[object Object]" toasts come from.
 */
function extractDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const detail = (payload as { detail?: unknown; message?: unknown }).detail
    ?? (payload as { message?: unknown }).message;

  if (typeof detail === "string") return detail.trim() || null;

  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const entry = item as { msg?: unknown; loc?: unknown };
          const field = Array.isArray(entry.loc)
            ? entry.loc.filter((p) => p !== "body").join(".")
            : null;
          const message = typeof entry.msg === "string" ? entry.msg : null;
          if (message) return field ? `${field}: ${message}` : message;
        }
        return null;
      })
      .filter(Boolean);
    return parts.length ? parts.join("; ") : null;
  }

  return null;
}

/** Human-readable fallback for a status code with no usable detail. */
function statusMessage(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 409) return "That conflicts with something that already exists.";
  if (status === 413) return "That file is too large to upload.";
  if (status === 422) return "Some of the details sent were invalid.";
  if (status === 429) return "Too many requests — wait a moment and try again.";
  if (status === 504) return "The server took too long to respond.";
  if (status >= 500) return "The server ran into a problem. Please try again.";
  return `Request failed (HTTP ${status}).`;
}

function networkMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "The request timed out. The server may be busy — please try again.";
  }
  if (err instanceof Error && /fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(err.message)) {
    return "Can't reach the server. Check your connection and that the backend is running.";
  }
  return err instanceof Error ? err.message : "Network error";
}

async function request<T>(
  path: string,
  { token, body, timeoutMs, ...options }: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const budget = timeoutMs ?? (AI_ROUTES.test(path) ? AI_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budget);

  try {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return {
        data: null,
        error: extractDetail(errorData) ?? statusMessage(response.status),
        status: response.status,
      };
    }

    if (response.status === 204) {
      return { data: {} as T, error: null, status: response.status };
    }

    const text = await response.text();
    const data: T = text ? JSON.parse(text) : ({} as T);
    return { data, error: null, status: response.status };
  } catch (err) {
    return {
      data: null,
      error: networkMessage(err),
      status: 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: "GET", ...opts }),
  post: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: "POST", body, ...opts }),
  put: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: "PUT", body, ...opts }),
  patch: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: "PATCH", body, ...opts }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: "DELETE", ...opts }),
};
