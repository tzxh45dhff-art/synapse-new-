"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api-client";
import type { UploadCompleteResponse } from "@/types/vault";

export async function completeUpload(
  vaultId: string,
  resourceId: string,
  storagePath: string,
  squadId: string,
): Promise<UploadCompleteResponse> {
  const res = await api.post<UploadCompleteResponse>(
    `/vaults/${vaultId}/resources/upload-complete`,
    { resource_id: resourceId, storage_path: storagePath },
  );
  revalidatePath(`/dashboard/squads/${squadId}/vaults/${vaultId}/resources`);
  return res;
}
