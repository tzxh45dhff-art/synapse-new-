"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api-client";
import type { VaultDetail } from "@/types/vault";

export async function archiveVault(vaultId: string, squadId: string): Promise<VaultDetail> {
  const vault = await api.post<VaultDetail>(`/vaults/${vaultId}/archive`, {});
  revalidatePath(`/dashboard/squads/${squadId}/vaults`);
  return vault;
}
