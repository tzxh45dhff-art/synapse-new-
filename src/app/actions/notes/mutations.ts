"use server";

import { revalidatePath } from "next/cache";
import { authedApi } from "@/lib/server-api";
import type { NoteDetail } from "@/types/notes";

function revalidateNotes(squadId: string, vaultId: string) {
  revalidatePath(`/dashboard/squads/${squadId}/vaults/${vaultId}/notes`);
}

export async function createNote(
  vaultId: string,
  squadId: string,
  input: { title: string; content?: string },
): Promise<NoteDetail> {
  const api = await authedApi();
  const note = await api.post<NoteDetail>(`/vaults/${vaultId}/notes`, {
    title: input.title,
    content: input.content ?? "",
  });
  revalidateNotes(squadId, vaultId);
  return note;
}

export async function updateNote(
  noteId: string,
  squadId: string,
  vaultId: string,
  input: {
    title?: string;
    content?: string;
    is_pinned?: boolean;
    change_summary?: string;
  },
): Promise<NoteDetail> {
  const api = await authedApi();
  const note = await api.patch<NoteDetail>(`/notes/${noteId}`, input);
  revalidateNotes(squadId, vaultId);
  return note;
}

export async function deleteNote(
  noteId: string,
  squadId: string,
  vaultId: string,
): Promise<void> {
  const api = await authedApi();
  await api.del<void>(`/notes/${noteId}`);
  revalidateNotes(squadId, vaultId);
}

export async function restoreVersion(
  noteId: string,
  versionId: string,
  squadId: string,
  vaultId: string,
): Promise<NoteDetail> {
  const api = await authedApi();
  const note = await api.post<NoteDetail>(`/notes/${noteId}/restore`, {
    version_id: versionId,
  });
  revalidateNotes(squadId, vaultId);
  return note;
}
