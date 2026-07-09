"use server";

import { revalidatePath } from "next/cache";
import { authedApi } from "@/lib/server-api";
import type { VaultDetail } from "@/types/vault";

export async function restoreVault(vaultId: string, squadId: string): Promise<VaultDetail> {
  const api = await authedApi();
  const vault = await api.post<VaultDetail>(`/vaults/${vaultId}/restore`, {});
  revalidatePath(`/dashboard/squads/${squadId}/vaults`);
  return vault;
}
