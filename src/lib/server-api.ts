import "server-only";

import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";

/**
 * Server-side authed API client. Attaches the current Supabase JWT and the
 * `/api/v1` prefix, mirroring the pattern used by the dashboard layout.
 * Throws on error so Server Actions surface failures to the caller.
 */
export async function authedApi() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  async function unwrap<T>(p: Promise<{ data: T | null; error: string | null }>): Promise<T> {
    const res = await p;
    if (res.error !== null || res.data === null) {
      throw new Error(res.error ?? "Request failed");
    }
    return res.data;
  }

  return {
    get: <T>(path: string) => unwrap(api.get<T>(`/api/v1${path}`, { token })),
    post: <T>(path: string, body: unknown) => unwrap(api.post<T>(`/api/v1${path}`, body, { token })),
    put: <T>(path: string, body: unknown) => unwrap(api.put<T>(`/api/v1${path}`, body, { token })),
    patch: <T>(path: string, body: unknown) => unwrap(api.patch<T>(`/api/v1${path}`, body, { token })),
    del: <T>(path: string) => unwrap(api.delete<T>(`/api/v1${path}`, { token })),
  };
}
