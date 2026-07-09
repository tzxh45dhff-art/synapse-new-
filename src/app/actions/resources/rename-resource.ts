"use server";

import { revalidatePath } from "next/cache";
import { authedApi } from "@/lib/server-api";
import type { ResourceDetail } from "@/types/vault";

export async function renameResource(
  resourceId: string,
  title: string,
  squadId: string,
  vaultId: string,
): Promise<ResourceDetail> {
  const api = await authedApi();
  const res = await api.patch<ResourceDetail>(`/resources/${resourceId}`, { title });
  revalidatePath(`/dashboard/squads/${squadId}/vaults/${vaultId}/resources`);
  return res;
}
