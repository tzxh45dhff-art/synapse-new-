"use server";

import { authedApi } from "@/lib/server-api";
import type { ChatMessage, ChatSession } from "@/types/chat";

export async function listChatSessions(): Promise<ChatSession[]> {
  const api = await authedApi();
  return api.get<ChatSession[]>(`/chat/sessions`);
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const api = await authedApi();
  return api.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`);
}
