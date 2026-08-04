"use server";

import { authedApi } from "@/lib/server-api";
import type {
  CodingGenerateRequest,
  CodingGenerateResponse,
  CodingGradeRequest,
  CodingGradeResponse,
  CodingRuntimeInfo,
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

/** Which languages the grading server can execute for real. */
export async function listCodingRuntimes(): Promise<CodingRuntimeInfo[]> {
  const api = await authedApi();
  return api.get<CodingRuntimeInfo[]>(`/coding/runtimes`);
}
