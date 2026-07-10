// Types for the global Ask AI chat assistant. Mirror the FastAPI chat schemas.

export type MessageRole = "user" | "assistant";

export interface ChatCitation {
  index: number;
  chunk_id: string;
  resource_id: string;
  resource_title: string;
  vault_id: string;
  vault_title: string;
  squad_id: string;
  page_number: number | null;
  heading: string | null;
  snippet: string;
  similarity: number;
}

export interface ChatSession {
  id: string;
  vault_id: string | null;
  title: string | null;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  citations: ChatCitation[];
}

export interface ChatGenerationUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  model: string;
  provider: string;
}

// SSE event payloads
export interface ChatMetaEvent {
  citations: ChatCitation[];
}
export interface ChatDoneEvent {
  message_id: string;
  session_id: string;
  generation: ChatGenerationUsage;
}
