"use server";

import { authedApi } from "@/lib/server-api";
import type {
  NoteDetail,
  NoteListItem,
  NoteVersion,
  PromptTemplate,
} from "@/types/notes";
import type { ResourceListItem } from "@/types/vault";

export async function listNotes(
  vaultId: string,
  filters?: { search?: string; source_type?: string; pinned?: boolean },
): Promise<NoteListItem[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.source_type) params.set("source_type", filters.source_type);
  if (filters?.pinned) params.set("pinned", "true");
  const qs = params.toString();
  const api = await authedApi();
  return api.get<NoteListItem[]>(`/vaults/${vaultId}/notes${qs ? `?${qs}` : ""}`);
}

export async function getNote(noteId: string): Promise<NoteDetail> {
  const api = await authedApi();
  return api.get<NoteDetail>(`/notes/${noteId}`);
}

export async function listVersions(noteId: string): Promise<NoteVersion[]> {
  const api = await authedApi();
  return api.get<NoteVersion[]>(`/notes/${noteId}/versions`);
}

export async function listTemplates(): Promise<PromptTemplate[]> {
  const api = await authedApi();
  return api.get<PromptTemplate[]>(`/notes/templates`);
}

export async function listVaultResources(vaultId: string): Promise<ResourceListItem[]> {
  const api = await authedApi();
  return api.get<ResourceListItem[]>(`/vaults/${vaultId}/resources`);
}

export async function exportNoteAction(
  noteId: string,
  format: string
): Promise<{ data: string; contentType: string }> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
  const res = await fetch(`${BACKEND_URL}/api/v1/notes/${noteId}/export?format=${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.detail ?? `Export failed: HTTP ${res.status}`);
  }

  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";

  return {
    data: base64,
    contentType,
  };
}

