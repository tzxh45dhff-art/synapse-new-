"use server";

import { revalidatePath } from "next/cache";
import { authedApi } from "@/lib/server-api";
import type { VaultDetail, CreateVaultInput } from "@/types/vault";

export async function createVault(squadId: string, data: CreateVaultInput): Promise<VaultDetail> {
  const api = await authedApi();
  const vault = await api.post<VaultDetail>(`/squads/${squadId}/vaults`, data);
  revalidatePath(`/dashboard/squads/${squadId}/vaults`);
  return vault;
}
