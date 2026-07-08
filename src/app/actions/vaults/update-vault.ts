"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api-client";
import type { VaultDetail, UpdateVaultInput } from "@/types/vault";

export async function updateVault(vaultId: string, squadId: string, data: UpdateVaultInput): Promise<VaultDetail> {
  const vault = await api.patch<VaultDetail>(`/vaults/${vaultId}`, data);
  revalidatePath(`/dashboard/squads/${squadId}/vaults`);
  revalidatePath(`/dashboard/squads/${squadId}/vaults/${vaultId}`);
  return vault;
}
