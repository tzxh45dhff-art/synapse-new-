/** Types for real practice-attempt tracking, dashboard insights, and flashcards. */

export type PracticeSessionType = "mcq" | "coding";

export interface PracticeAttemptPayload {
  vault_id: string;
  session_type: PracticeSessionType;
  score_pct: number;
  topic?: string;
}

export interface StreakRead {
  current_streak: number;
  longest_streak: number;
}

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface MasteryTopic {
  topic: string;
  mastery_score: number;
  attempts: number;
}

export interface ScoreTrendPoint {
  recorded_at: string;
  score_pct: number;
  session_type: PracticeSessionType;
}

export interface DashboardInsights {
  has_data: boolean;
  streak: StreakRead;
  heatmap: HeatmapDay[];
  mastery_avg: number | null;
  strongest_topic: MasteryTopic | null;
  weakest_topic: MasteryTopic | null;
  score_trend: ScoreTrendPoint[];
  trend_change_pct: number | null;
}

export interface VaultInsights {
  has_data: boolean;
  concepts_avg: number | null;
  quiz_avg: number | null;
  coding_avg: number | null;
  flashcard_coverage_pct: number | null;
  attempts_count: number;
  weakest_topic: string | null;
}

export interface FlashcardItem {
  id: string;
  vault_id: string;
  vault_title: string;
  front: string;
  back: string;
  difficulty: string | null;
  status: string;
  next_review_at: string;
}
