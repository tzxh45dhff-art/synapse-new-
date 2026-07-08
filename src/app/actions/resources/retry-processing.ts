"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api-client";
import type { ResourceDetail } from "@/types/vault";

export async function retryProcessing(
  resourceId: string,
  squadId: string,
  vaultId: string,
): Promise<ResourceDetail> {
  const res = await api.post<ResourceDetail>(`/resources/${resourceId}/retry`, {});
  revalidatePath(`/dashboard/squads/${squadId}/vaults/${vaultId}/resources`);
  return res;
}

export async function cancelProcessing(
  resourceId: string,
  squadId: string,
  vaultId: string,
): Promise<ResourceDetail> {
  const res = await api.post<ResourceDetail>(`/resources/${resourceId}/cancel`, {});
  revalidatePath(`/dashboard/squads/${squadId}/vaults/${vaultId}/resources`);
  return res;
}
