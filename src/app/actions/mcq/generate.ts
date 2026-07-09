"use server";

import { authedApi } from "@/lib/server-api";
import type { MCQGenerateRequest, MCQGenerateResponse } from "@/types/mcq";

export async function generateMCQ(
  vaultId: string,
  data: MCQGenerateRequest
): Promise<MCQGenerateResponse> {
  const api = await authedApi();
  return api.post<MCQGenerateResponse>(`/vaults/${vaultId}/mcq/generate`, data);
}
