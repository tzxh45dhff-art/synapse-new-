"use server";

import { authedApi } from "@/lib/server-api";
import type {
  CodingGenerateRequest,
  CodingGenerateResponse,
  CodingGradeRequest,
  CodingGradeResponse,
} from "@/types/coding";

export async function generateCodingQuestions(
  vaultId: string,
  data: CodingGenerateRequest
): Promise<CodingGenerateResponse> {
  const api = await authedApi();
  return api.post<CodingGenerateResponse>(`/vaults/${vaultId}/coding/generate`, data);
}

export async function gradeCodingQuestion(
  vaultId: string,
  data: CodingGradeRequest
): Promise<CodingGradeResponse> {
  const api = await authedApi();
  return api.post<CodingGradeResponse>(`/vaults/${vaultId}/coding/grade`, data);
}

