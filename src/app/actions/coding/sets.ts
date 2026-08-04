"use server";

import { authedApi } from "@/lib/server-api";
import type { CodingSetListItem, CodingSetDetail } from "@/types/coding";

export async function listCodingSets(
  vaultId: string
): Promise<CodingSetListItem[]> {
  const api = await authedApi();
  return api.get<CodingSetListItem[]>(`/vaults/${vaultId}/coding/sets`);
}

export async function getCodingSet(
  vaultId: string,
  setId: string
): Promise<CodingSetDetail> {
  const api = await authedApi();
  return api.get<CodingSetDetail>(`/vaults/${vaultId}/coding/sets/${setId}`);
}

export async function deleteCodingSet(
  vaultId: string,
  setId: string
): Promise<void> {
  const api = await authedApi();
  await api.del(`/vaults/${vaultId}/coding/sets/${setId}`);
}
