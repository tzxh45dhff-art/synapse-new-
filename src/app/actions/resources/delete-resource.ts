"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api-client";

export async function deleteResource(
  resourceId: string,
  squadId: string,
  vaultId: string,
): Promise<void> {
  await api.delete(`/resources/${resourceId}`);
  revalidatePath(`/dashboard/squads/${squadId}/vaults/${vaultId}/resources`);
}
