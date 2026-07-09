"use server";

import { authedApi } from "@/lib/server-api";
import type { ResourceDetail, ResourceListItem, ResourceStatus } from "@/types/vault";

export async function listResources(vaultId: string): Promise<ResourceListItem[]> {
  const api = await authedApi();
  return api.get<ResourceListItem[]>(`/vaults/${vaultId}/resources`);
}

export async function getResource(resourceId: string): Promise<ResourceDetail> {
  const api = await authedApi();
  return api.get<ResourceDetail>(`/resources/${resourceId}`);
}

export async function getResourceStatus(resourceId: string): Promise<ResourceStatus> {
  const api = await authedApi();
  return api.get<ResourceStatus>(`/resources/${resourceId}/status`);
}
