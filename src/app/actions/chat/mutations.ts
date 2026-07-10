"use server";

import { authedApi } from "@/lib/server-api";
import type { ChatSession } from "@/types/chat";

export async function createChatSession(vaultId?: string): Promise<ChatSession> {
  const api = await authedApi();
  return api.post<ChatSession>(`/chat/sessions`, { vault_id: vaultId ?? null });
}

export async function submitChatFeedback(
  messageId: string,
  rating: 1 | -1,
): Promise<void> {
  const api = await authedApi();
  await api.post<void>(`/chat/messages/${messageId}/feedback`, { rating });
}
