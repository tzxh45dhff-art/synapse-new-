/**
 * Types for the squad group chat (WhatsApp-style, per-squad, multi-user).
 * Distinct from the single-user "Ask AI" chat in @/types/chat.
 */

import type { MemberProfile } from "@/types/squad";

export type SquadMessageType = "text" | "file" | "resource" | "note";

export interface FileAttachment {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}

export interface SharedAttachment {
  ref_id: string;
  vault_id: string;
  title: string;
  subtitle: string | null;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  user_ids: string[];
}

export interface ReplyPreview {
  id: string;
  sender_id: string;
  sender_name: string | null;
  content: string;
  message_type: SquadMessageType;
  deleted: boolean;
}

export interface SquadMessage {
  id: string;
  squad_id: string;
  sender_id: string;
  sender: MemberProfile | null;
  content: string;
  message_type: SquadMessageType;
  attachment: (FileAttachment & SharedAttachment) | Record<string, unknown> | null;
  reply_to: ReplyPreview | null;
  reactions: ReactionSummary[];
  created_at: string;
  edited_at: string | null;
  deleted: boolean;
}

export interface MessagePage {
  messages: SquadMessage[];
  has_more: boolean;
  next_before: string | null;
}

/** Lightweight signal broadcast over Supabase Realtime (no sensitive payload). */
export type ChatSignal =
  | { kind: "new"; id: string; sender_id: string }
  | { kind: "update"; id: string }
  | { kind: "typing"; user_id: string; name: string };

export interface SendMessagePayload {
  content?: string;
  message_type?: SquadMessageType;
  file?: FileAttachment;
  shared?: SharedAttachment;
  reply_to_id?: string;
}
