"use server";

import { authedApi } from "@/lib/server-api";
import type { MCQSetListItem, MCQSetDetail } from "@/types/mcq";

export async function listMCQSets(vaultId: string): Promise<MCQSetListItem[]> {
  const api = await authedApi();
  return api.get<MCQSetListItem[]>(`/vaults/${vaultId}/mcq/sets`);
}

export async function getMCQSet(
  vaultId: string,
  setId: string
): Promise<MCQSetDetail> {
  const api = await authedApi();
  return api.get<MCQSetDetail>(`/vaults/${vaultId}/mcq/sets/${setId}`);
}

export async function deleteMCQSet(
  vaultId: string,
  setId: string
): Promise<void> {
  const api = await authedApi();
  await api.del(`/vaults/${vaultId}/mcq/sets/${setId}`);
}
