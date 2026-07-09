"use server";

import { revalidatePath } from "next/cache";
import { authedApi } from "@/lib/server-api";

export async function deleteResource(
  resourceId: string,
  squadId: string,
  vaultId: string,
): Promise<void> {
  const api = await authedApi();
  await api.del<void>(`/resources/${resourceId}`);
  revalidatePath(`/dashboard/squads/${squadId}/vaults/${vaultId}/resources`);
}
