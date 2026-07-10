"use server";

import { authedApi } from "@/lib/server-api";
import type { DashboardInsights, FlashcardItem, VaultInsights } from "@/types/intelligence";

export async function getDashboardInsights(): Promise<DashboardInsights> {
  const api = await authedApi();
  return api.get<DashboardInsights>(`/dashboard/insights`);
}

export async function getVaultInsights(vaultId: string): Promise<VaultInsights> {
  const api = await authedApi();
  return api.get<VaultInsights>(`/vaults/${vaultId}/insights`);
}

export async function getDueFlashcards(limit = 5): Promise<FlashcardItem[]> {
  const api = await authedApi();
  return api.get<FlashcardItem[]>(`/flashcards/due?limit=${limit}`);
}
