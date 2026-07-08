"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api-client";
import type { ResourceDetail } from "@/types/vault";

export async function renameResource(
  resourceId: string,
  title: string,
  squadId: string,
  vaultId: string,
): Promise<ResourceDetail> {
  const res = await api.patch<ResourceDetail>(`/resources/${resourceId}`, { title });
  revalidatePath(`/dashboard/squads/${squadId}/vaults/${vaultId}/resources`);
  return res;
}
