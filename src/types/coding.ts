// TypeScript types for the Coding Questions Generator

export type CodingLanguage = "python" | "java" | "cpp" | "javascript" | "typescript" | "go";
export type CodingDifficulty = "easy" | "medium" | "hard" | "mixed";
export type CodingQuestionType = "solve" | "debug" | "trace" | "fill";

export interface CodingGenerateRequest {
  language: CodingLanguage;
  difficulty: CodingDifficulty;
  question_types: CodingQuestionType[];
  count: number;
  topics: string;
  use_vault_context?: boolean;
  custom_instruction?: string;
}

export interface CodingExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface CodingQuestion {
  number: number;
  type: CodingQuestionType;
  title: string;
  language: string;
  difficulty: "easy" | "medium" | "hard";
  topic_hint?: string;
  problem: string;
  code_snippet?: string;
  examples: CodingExample[];
  constraints: string[];
  hints: string[];
  solution: string;
  solution_explanation: string;
}

export interface CodingGenerateResponse {
  vault_id: string;
  subject_name?: string;
  language: string;
  difficulty: string;
  requested_count: number;
  generated_count: number;
  topics: string;
  questions: CodingQuestion[];
  generated_at: string;
  model_used?: string;
}

export interface CodingGradeRequest {
  title: string;
  type: CodingQuestionType;
  problem: string;
  language: string;
  code: string;
  solution: string;
  examples: CodingExample[];
  constraints: string[];
}

export interface CodingGradeResponse {
  status: "Accepted" | "Wrong Answer" | "Runtime Error" | "Compilation Error" | "Time Limit Exceeded";
  test_cases_passed: number;
  total_test_cases: number;
  feedback: string;
  compiler_output?: string;
}

