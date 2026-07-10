"use server";

import { authedApi } from "@/lib/server-api";
import type { MessagePage, SquadMessage } from "@/types/squad-chat";

export async function getMessages(
  squadId: string,
  before?: string,
): Promise<MessagePage> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : "";
  const api = await authedApi();
  return api.get<MessagePage>(`/squads/${squadId}/messages${qs}`);
}

export async function getMessage(
  squadId: string,
  messageId: string,
): Promise<SquadMessage> {
  const api = await authedApi();
  return api.get<SquadMessage>(`/squads/${squadId}/messages/${messageId}`);
}
