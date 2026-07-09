"use server";

import { revalidatePath } from "next/cache";
import { authedApi } from "@/lib/server-api";

export async function deleteVault(vaultId: string, squadId: string): Promise<void> {
  const api = await authedApi();
  await api.del<void>(`/vaults/${vaultId}`);
  revalidatePath(`/dashboard/squads/${squadId}/vaults`);
}
