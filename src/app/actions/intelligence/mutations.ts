"use server";

import { authedApi } from "@/lib/server-api";
import type { FlashcardItem, PracticeAttemptPayload } from "@/types/intelligence";

export async function recordPracticeAttempt(payload: PracticeAttemptPayload): Promise<void> {
  const api = await authedApi();
  await api.post<void>(`/practice/attempts`, payload);
}

export async function reviewFlashcard(flashcardId: string, rating: 0 | 1 | 2 | 3): Promise<void> {
  const api = await authedApi();
  await api.post<void>(`/flashcards/${flashcardId}/review`, { rating });
}

export async function generateFlashcards(vaultId: string, count = 5): Promise<FlashcardItem[]> {
  const api = await authedApi();
  return api.post<FlashcardItem[]>(`/vaults/${vaultId}/flashcards/generate`, { count });
}
