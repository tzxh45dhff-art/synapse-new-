// TypeScript types for the MCQ Generator

export type MCQDifficulty = "easy" | "medium" | "hard" | "mixed";

export interface MCQGenerateRequest {
  difficulty: MCQDifficulty;
  count: number;
  topics: string;
  use_vault_context?: boolean;
  custom_instruction?: string;
}

export interface MCQOption {
  key: "A" | "B" | "C" | "D";
  text: string;
}

export interface MCQQuestion {
  number: number;
  question: string;
  options: MCQOption[];
  correct_answer: "A" | "B" | "C" | "D";
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  topic_hint: string | null;
}

export interface MCQGenerateResponse {
  vault_id: string;
  subject_name: string | null;
  difficulty: string;
  requested_count: number;
  generated_count: number;
  topics: string;
  questions: MCQQuestion[];
  generated_at: string;
  model_used: string | null;
}
