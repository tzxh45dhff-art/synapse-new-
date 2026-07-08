// Types for the AI Notes Generator. Mirror the FastAPI note schemas.

export type GenerationMode =
  | "full_notes"
  | "summary"
  | "exam_notes"
  | "revision_notes"
  | "detailed_notes"
  | "bullet_notes"
  | "concept_explanation"
  | "formula_sheet"
  | "cheat_sheet"
  | "definitions_only"
  | "qa_notes";

export type RetrievalMode = "vault" | "resources" | "chapters" | "pages";
export type ExportFormat = "markdown" | "pdf" | "docx";
export type NoteSourceType = "manual" | "ai_generated" | "hybrid";

export interface NoteGenerationSettings {
  length: "short" | "medium" | "long" | "comprehensive";
  difficulty: "beginner" | "intermediate" | "advanced";
  audience: string;
  language: string;
  output_format: "markdown";
  tone: "neutral" | "formal" | "casual" | "concise";
  exam_focus: boolean;
  include_citations: boolean;
}

export const DEFAULT_SETTINGS: NoteGenerationSettings = {
  length: "medium",
  difficulty: "intermediate",
  audience: "university student",
  language: "English",
  output_format: "markdown",
  tone: "neutral",
  exam_focus: false,
  include_citations: true,
};

export interface NoteGenerateRequest {
  mode: GenerationMode;
  retrieval_mode: RetrievalMode;
  title?: string | null;
  query?: string | null;
  resource_ids?: string[];
  page_resource_id?: string | null;
  pages?: number[];
  chapters?: string[];
  settings: NoteGenerationSettings;
  max_context_chunks?: number;
}

export interface Citation {
  index: number;
  chunk_id: string;
  resource_id: string;
  resource_title: string;
  page_number: number | null;
  heading: string | null;
  snippet: string;
  similarity: number;
}

export interface GenerationUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  model: string;
  provider: string;
}

export interface NoteListItem {
  id: string;
  vault_id: string;
  title: string;
  source_type: NoteSourceType;
  content_format: string;
  is_pinned: boolean;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface NoteDetail extends NoteListItem {
  content: string;
  created_by: string;
  metadata: Record<string, unknown>;
}

export interface NoteVersion {
  id: string;
  note_id: string;
  version_number: number;
  content: string;
  created_by: string;
  change_summary: string | null;
  created_at: string;
}

export interface PromptTemplate {
  key: GenerationMode;
  version: string;
  label: string;
  description: string;
}

// SSE event payloads
export interface MetaEvent {
  mode: string;
  model: string | null;
  citations: Citation[];
}
export interface DoneEvent {
  note_id: string;
  word_count: number;
  generation: GenerationUsage;
}
