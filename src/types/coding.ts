// TypeScript types for the Coding Questions Generator

export type CodingLanguage = "python" | "java" | "c" | "cpp" | "javascript" | "typescript" | "go";
export type CodingDifficulty = "easy" | "medium" | "hard" | "mixed";
export type CodingQuestionType = "solve" | "debug" | "trace" | "fill";
export type CodingIOMode = "function" | "stdio";
export type ComparisonMode = "trim" | "exact" | "ignore_case" | "unordered" | "float";
export type GradeStatus =
  | "Accepted"
  | "Wrong Answer"
  | "Runtime Error"
  | "Compilation Error"
  | "Time Limit Exceeded";

export interface CodingGenerateRequest {
  language?: CodingLanguage;
  difficulty: CodingDifficulty;
  question_types: CodingQuestionType[];
  count: number;
  topics: string;
  use_vault_context?: boolean;
  resource_ids?: string[];
  extract_exact?: boolean;
  custom_instruction?: string;
}

export interface CodingExample {
  input: string;
  output: string;
  explanation?: string;
}

/** One executable assertion. Hidden cases never reach the browser. */
export interface CodingTestCase {
  name?: string | null;
  args?: unknown[] | null;
  kwargs?: Record<string, unknown> | null;
  stdin?: string | null;
  expected?: unknown;
  expected_stdout?: string | null;
  hidden: boolean;
  explanation?: string | null;
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

  // Execution contract
  io_mode?: CodingIOMode;
  entry_point?: string | null;
  test_cases?: CodingTestCase[];
  comparison?: ComparisonMode;
  float_tolerance?: number;
  time_limit_ms?: number;
  tests_verified?: boolean;
  complexity?: string | null;
  /** Number of hidden cases that exist server-side (values withheld). */
  hidden_test_count?: number;
}

export interface CodingGenerateResponse {
  id: string | null;
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
  verified_count?: number;
  runtime_available?: boolean;
  warnings?: string[];
}

export interface CodingGradeRequest {
  code: string;
  /** Preferred: grade against the stored question so hidden tests stay server-side. */
  set_id?: string | null;
  question_number?: number | null;
  /** "Run" executes only the visible sample cases; "Submit" runs everything. */
  sample_only?: boolean;

  // Inline fallback for sets that were never persisted
  title?: string;
  type?: CodingQuestionType;
  problem?: string;
  language?: string;
  solution?: string;
  examples?: CodingExample[];
  constraints?: string[];
}

export interface CodingTestResult {
  index: number;
  name?: string | null;
  hidden: boolean;
  passed: boolean;
  skipped: boolean;
  input_display?: string | null;
  expected_display?: string | null;
  actual_display?: string | null;
  stdout?: string | null;
  error?: string | null;
  duration_ms: number;
}

export interface CodingGradeResponse {
  status: GradeStatus;
  test_cases_passed: number;
  total_test_cases: number;
  feedback: string;
  compiler_output?: string;
  /** "executed" = really ran in the sandbox; "simulated" = AI review only. */
  engine: "executed" | "simulated";
  results: CodingTestResult[];
  runtime_ms: number;
  hidden_passed: number;
  hidden_total: number;
  sample_only: boolean;
  warnings: string[];
}

export interface CodingRuntimeInfo {
  language: string;
  display: string;
  available: boolean;
  version?: string | null;
  reason?: string | null;
}

// ── Persisted set types ─────────────────────────────────────────────────────

export interface CodingSetListItem {
  id: string;
  title: string;
  language: string;
  difficulty: string;
  question_count: number;
  topics: string;
  subject_name: string | null;
  created_by: string;
  created_at: string;
}

export interface CodingSetDetail {
  id: string;
  vault_id: string;
  title: string;
  language: string;
  difficulty: string;
  topics: string;
  question_count: number;
  questions: CodingQuestion[];
  subject_name: string | null;
  model_used: string | null;
  created_by: string;
  created_at: string;
}
