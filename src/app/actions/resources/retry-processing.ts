"use server";

import { revalidatePath } from "next/cache";
import { authedApi } from "@/lib/server-api";
import type { ResourceDetail } from "@/types/vault";

export async function retryProcessing(
  resourceId: string,
  squadId: string,
  vaultId: string,
): Promise<ResourceDetail> {
  const api = await authedApi();
  const res = await api.post<ResourceDetail>(`/resources/${resourceId}/retry`, {});
  revalidatePath(`/dashboard/squads/${squadId}/vaults/${vaultId}/resources`);
  return res;
}

export async function cancelProcessing(
  resourceId: string,
  squadId: string,
  vaultId: string,
): Promise<ResourceDetail> {
  const api = await authedApi();
  const res = await api.post<ResourceDetail>(`/resources/${resourceId}/cancel`, {});
  revalidatePath(`/dashboard/squads/${squadId}/vaults/${vaultId}/resources`);
  return res;
}
