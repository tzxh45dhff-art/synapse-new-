// TypeScript types for the Vault & Resource system

export type ProcessingStage =
  | "uploaded"
  | "validating"
  | "extracting"
  | "chunking"
  | "embedding"
  | "complete"
  | "failed"
  | "cancelled";

export const STAGE_LABELS: Record<ProcessingStage, string> = {
  uploaded: "Queued",
  validating: "Validating",
  extracting: "Extracting Metadata",
  chunking: "Chunking",
  embedding: "Embedding",
  complete: "Ready",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const STAGE_PROGRESS: Record<ProcessingStage, number> = {
  uploaded: 5,
  validating: 25,
  extracting: 60,
  chunking: 75,
  embedding: 90,
  complete: 100,
  failed: 0,
  cancelled: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Subject
// ─────────────────────────────────────────────────────────────────────────────

export interface SubjectItem {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  parent_id: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vault
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultStats {
  resource_count: number;
  storage_bytes: number;
  pdf_count: number;
  ppt_count: number;
  doc_count: number;
  image_count: number;
  other_count: number;
  last_upload_at: string | null;
  contributor_count: number;
}

export interface VaultListItem {
  id: string;
  squad_id: string;
  title: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_archived: boolean;
  subject: SubjectItem | null;
  statistics: VaultStats | null;
  created_at: string;
  updated_at: string;
}

export interface VaultDetail extends VaultListItem {
  created_by: string;
}

export interface CreateVaultInput {
  title: string;
  subject_id: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateVaultInput {
  title?: string;
  subject_id?: string;
  description?: string;
  color?: string;
  icon?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource
// ─────────────────────────────────────────────────────────────────────────────

export interface UploaderProfile {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface ResourceMetadata {
  pages: number | null;
  words: number | null;
  images: number | null;
  slides: number | null;
  language: string | null;
  detected_title: string | null;
  author: string | null;
  pdf_version: string | null;
  reading_time_mins: number | null;
  width_px: number | null;
  height_px: number | null;
  extracted_at: string;
}

export interface ProcessingJob {
  id: string;
  job_type: string;
  status: string;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ResourceListItem {
  id: string;
  vault_id: string;
  title: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  mime_type: string | null;
  processing_status: string;
  processing_stage: ProcessingStage;
  is_ai_ready: boolean;
  uploader: UploaderProfile | null;
  created_at: string;
  updated_at: string;
}

export interface ResourceDetail extends ResourceListItem {
  file_url: string;
  processing_error: string | null;
  processed_at: string | null;
  metadata_record: ResourceMetadata | null;
  processing_jobs: ProcessingJob[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload flow
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadUrlResponse {
  resource_id: string;
  upload_url: string;
  storage_path: string;
  expires_at: string;
}

export interface UploadCompleteResponse {
  resource_id: string;
  processing_stage: ProcessingStage;
  message: string;
}

export interface ResourceStatus {
  id: string;
  processing_status: string;
  processing_stage: ProcessingStage;
  stage_label: string;
  progress_pct: number;
  error: string | null;
  is_ai_ready: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload state (client-side)
// ─────────────────────────────────────────────────────────────────────────────

export type UploadPhase =
  | "idle"
  | "requesting_url"
  | "uploading"
  | "notifying"
  | "processing"
  | "complete"
  | "error";

export interface UploadItem {
  id: string; // local uuid for tracking
  file: File;
  phase: UploadPhase;
  progress: number; // 0-100 for upload byte progress
  resource_id?: string;
  processing_stage?: ProcessingStage;
  error?: string;
}

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "ppt",
  "text/plain": "txt",
  "text/markdown": "md",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
