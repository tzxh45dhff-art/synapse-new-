"use server";

import { authedApi } from "@/lib/server-api";
import type { SubjectItem, VaultDetail, VaultListItem } from "@/types/vault";

export async function getVault(vaultId: string): Promise<VaultDetail> {
  const api = await authedApi();
  return api.get<VaultDetail>(`/vaults/${vaultId}`);
}

export async function listVaults(
  squadId: string,
  filters?: { search?: string; includeArchived?: boolean; sort?: string },
): Promise<VaultListItem[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.includeArchived) params.set("include_archived", "true");
  if (filters?.sort) params.set("sort", filters.sort);
  const qs = params.toString();
  const api = await authedApi();
  return api.get<VaultListItem[]>(`/squads/${squadId}/vaults${qs ? `?${qs}` : ""}`);
}

export async function listSubjects(): Promise<SubjectItem[]> {
  const api = await authedApi();
  return api.get<SubjectItem[]>(`/subjects`);
}
