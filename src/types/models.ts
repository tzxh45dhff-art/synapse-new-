/**
 * Shared TypeScript type definitions for the Bunker application.
 * These mirror the Pydantic schemas from the FastAPI backend.
 * Source of truth: database schema (bunker_database_v2.md)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

export type UUID = string;
export type ISOTimestamp = string;
export type ISODate = string;

// ─────────────────────────────────────────────────────────────────────────────
// Auth & Identity
// ─────────────────────────────────────────────────────────────────────────────

export interface Profile {
  id: UUID;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  university: string | null;
  year_of_study: number | null;
  timezone: string;
  onboarding_completed: boolean;
  metadata: Record<string, unknown>;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
  deleted_at: ISOTimestamp | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Squads & Collaboration
// ─────────────────────────────────────────────────────────────────────────────

export type SquadRole = "owner" | "admin" | "member" | "viewer";

export interface Squad {
  id: UUID;
  name: string;
  description: string | null;
  avatar_url: string | null;
  invite_code: string;
  is_personal: boolean;
  max_members: number;
  created_by: UUID;
  metadata: Record<string, unknown>;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
  deleted_at: ISOTimestamp | null;
}

export interface SquadMember {
  id: UUID;
  squad_id: UUID;
  user_id: UUID;
  role: SquadRole;
  joined_at: ISOTimestamp;
  removed_at: ISOTimestamp | null;
}

export interface Invitation {
  id: UUID;
  squad_id: UUID;
  invited_by: UUID;
  invited_email: string | null;
  invited_user_id: UUID | null;
  token: string;
  role: SquadRole;
  status: "pending" | "accepted" | "declined" | "expired" | "revoked";
  expires_at: ISOTimestamp;
  responded_at: ISOTimestamp | null;
  created_at: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vaults & Resources
// ─────────────────────────────────────────────────────────────────────────────

export interface Subject {
  id: UUID;
  name: string;
  slug: string;
  icon: string | null;
  parent_id: UUID | null;
  created_at: ISOTimestamp;
}

export interface Vault {
  id: UUID;
  squad_id: UUID;
  subject_id: UUID | null;
  created_by: UUID;
  title: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_archived: boolean;
  metadata: Record<string, unknown>;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
  deleted_at: ISOTimestamp | null;
}

export type ResourceFileType = "pdf" | "pptx" | "docx" | "image" | "text" | "other";
export type ResourceProcessingStatus =
  | "pending"
  | "processing"
  | "chunking"
  | "embedding"
  | "ready"
  | "failed"
  | "reprocessing";

export interface Resource {
  id: UUID;
  vault_id: UUID;
  uploaded_by: UUID;
  title: string;
  file_name: string;
  file_url: string;
  file_type: ResourceFileType;
  file_size_bytes: number;
  mime_type: string | null;
  page_count: number | null;
  processing_status: ResourceProcessingStatus;
  processing_error: string | null;
  processed_at: ISOTimestamp | null;
  metadata: Record<string, unknown>;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
  deleted_at: ISOTimestamp | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes
// ─────────────────────────────────────────────────────────────────────────────

export type NoteSourceType = "manual" | "ai_generated" | "hybrid";
export type NoteContentFormat = "markdown" | "html" | "plaintext";

export interface Note {
  id: UUID;
  vault_id: UUID;
  created_by: UUID;
  title: string;
  content: string;
  content_format: NoteContentFormat;
  source_type: NoteSourceType;
  is_pinned: boolean;
  word_count: number;
  metadata: Record<string, unknown>;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
  deleted_at: ISOTimestamp | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quizzes
// ─────────────────────────────────────────────────────────────────────────────

export type QuizDifficulty = "easy" | "medium" | "hard" | "adaptive";
export type QuizQuestionType = "mcq" | "true_false" | "short_answer" | "fill_blank" | "multi_select";
export type QuizSessionStatus = "in_progress" | "completed" | "abandoned";

export interface QuizOption {
  id: string;
  text: string;
  is_correct: boolean;
}

export interface Quiz {
  id: UUID;
  vault_id: UUID;
  created_by: UUID;
  title: string;
  description: string | null;
  source_type: "manual" | "ai_generated";
  difficulty: QuizDifficulty;
  question_count: number;
  time_limit_secs: number | null;
  is_published: boolean;
  metadata: Record<string, unknown>;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
  deleted_at: ISOTimestamp | null;
}

export interface QuizQuestion {
  id: UUID;
  quiz_id: UUID;
  question_text: string;
  question_type: QuizQuestionType;
  options: QuizOption[] | null;
  correct_answer: string | null;
  explanation: string | null;
  difficulty: QuizDifficulty | null;
  points: number;
  order_index: number;
  source_chunk_id: UUID | null;
  metadata: Record<string, unknown>;
  created_at: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Flashcards & SRS
// ─────────────────────────────────────────────────────────────────────────────

export type SRSStatus = "new" | "learning" | "review" | "relearning" | "suspended";

export interface Flashcard {
  id: UUID;
  vault_id: UUID;
  created_by: UUID;
  front: string;
  back: string;
  source_type: "manual" | "ai_generated";
  difficulty: string | null;
  source_chunk_id: UUID | null;
  is_archived: boolean;
  metadata: Record<string, unknown>;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
  deleted_at: ISOTimestamp | null;
}

export interface SpacedRepetitionState {
  id: UUID;
  flashcard_id: UUID;
  user_id: UUID;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: ISOTimestamp;
  last_reviewed_at: ISOTimestamp | null;
  status: SRSStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// Intelligence Layer
// ─────────────────────────────────────────────────────────────────────────────

export interface TopicMastery {
  id: UUID;
  user_id: UUID;
  vault_id: UUID;
  topic: string;
  mastery_score: number;
  confidence: number | null;
  quiz_attempts: number;
  flashcard_reviews: number;
  last_assessed_at: ISOTimestamp | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface StudySession {
  id: UUID;
  user_id: UUID;
  vault_id: UUID | null;
  squad_id: UUID | null;
  session_type: "quiz" | "flashcard" | "reading" | "notes" | "chat" | "roadmap" | "general";
  started_at: ISOTimestamp;
  ended_at: ISOTimestamp | null;
  duration_secs: number | null;
  focus_score: number | null;
  metadata: Record<string, unknown>;
}

export interface ExamReadiness {
  id: UUID;
  user_id: UUID;
  vault_id: UUID;
  exam_id: UUID | null;
  readiness_score: number;
  coverage_pct: number | null;
  weak_topic_count: number;
  strong_topic_count: number;
  total_study_mins: number;
  last_computed_at: ISOTimestamp;
  metadata: Record<string, unknown>;
  updated_at: ISOTimestamp;
}

export interface Exam {
  id: UUID;
  vault_id: UUID;
  created_by: UUID;
  title: string;
  exam_date: ISOTimestamp | null;
  weightage: number | null;
  syllabus_topics: string[] | null;
  notes: string | null;
  status: "upcoming" | "completed" | "cancelled";
  metadata: Record<string, unknown>;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat (Ask My Vault)
// ─────────────────────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant" | "system";

export interface ContextChunk {
  chunk_id: UUID;
  content_preview: string;
  similarity_score: number;
  page_number: number | null;
  resource_title: string;
}

export interface ChatMessage {
  id: UUID;
  session_id: UUID;
  role: ChatRole;
  content: string;
  token_count: number | null;
  context_chunks: ContextChunk[] | null;
  generation_id: UUID | null;
  metadata: Record<string, unknown>;
  created_at: ISOTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Expenses
// ─────────────────────────────────────────────────────────────────────────────

export interface Expense {
  id: UUID;
  squad_id: UUID;
  paid_by: UUID;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  category: string | null;
  receipt_url: string | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
  deleted_at: ISOTimestamp | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Response Wrappers
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface ApiError {
  detail: string;
  status_code: number;
}
