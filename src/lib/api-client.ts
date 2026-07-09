/**
 * Typed HTTP client for communicating with the FastAPI backend.
 * All requests from Server Actions go through this module.
 * Automatically attaches the Supabase JWT as a Bearer token.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string;
};

type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

async function request<T>(
  path: string,
  { token, body, ...options }: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        data: null,
        error: errorData?.detail ?? `HTTP ${response.status}`,
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
      error: err instanceof Error ? err.message : "Network error",
      status: 0,
    };
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
