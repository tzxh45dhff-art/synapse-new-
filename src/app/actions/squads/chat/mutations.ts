"use server";

import { authedApi } from "@/lib/server-api";
import type { SendMessagePayload, SquadMessage } from "@/types/squad-chat";

export async function sendMessage(
  squadId: string,
  payload: SendMessagePayload,
): Promise<SquadMessage> {
  const api = await authedApi();
  return api.post<SquadMessage>(`/squads/${squadId}/messages`, payload);
}

export async function deleteMessage(
  squadId: string,
  messageId: string,
): Promise<void> {
  const api = await authedApi();
  await api.del<void>(`/squads/${squadId}/messages/${messageId}`);
}

export async function toggleReaction(
  squadId: string,
  messageId: string,
  emoji: string,
): Promise<void> {
  const api = await authedApi();
  await api.put<void>(`/squads/${squadId}/messages/${messageId}/reactions`, { emoji });
}

export async function getChatUploadUrl(
  squadId: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
): Promise<{ upload_url: string; storage_path: string }> {
  const api = await authedApi();
  return api.post(`/squads/${squadId}/messages/upload-url`, {
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
  });
}

export async function getChatAttachmentUrl(
  squadId: string,
  storagePath: string,
): Promise<{ download_url: string }> {
  const api = await authedApi();
  return api.post(`/squads/${squadId}/messages/attachment-url`, {
    storage_path: storagePath,
  });
}
