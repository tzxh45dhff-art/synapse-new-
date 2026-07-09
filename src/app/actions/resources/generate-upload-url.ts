"use server";

import { authedApi } from "@/lib/server-api";
import type { UploadUrlResponse } from "@/types/vault";

export async function generateUploadUrl(
  vaultId: string,
  fileName: string,
  mimeType: string,
  fileSizeBytes: number,
): Promise<UploadUrlResponse> {
  const api = await authedApi();
  return api.post<UploadUrlResponse>(`/vaults/${vaultId}/resources/upload-url`, {
    file_name: fileName,
    mime_type: mimeType,
    file_size_bytes: fileSizeBytes,
  });
}
