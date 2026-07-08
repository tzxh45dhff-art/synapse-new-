"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api-client";

export async function deleteVault(vaultId: string, squadId: string): Promise<void> {
  await api.delete(`/vaults/${vaultId}`);
  revalidatePath(`/dashboard/squads/${squadId}/vaults`);
}
