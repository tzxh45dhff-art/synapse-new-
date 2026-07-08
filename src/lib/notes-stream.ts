"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  DoneEvent,
  MetaEvent,
  NoteGenerateRequest,
} from "@/types/notes";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export interface StreamHandlers {
  onMeta?: (meta: MetaEvent) => void;
  onDelta?: (text: string) => void;
  onDone?: (done: DoneEvent) => void;
  onError?: (message: string) => void;
}

/** POST a generation request and dispatch SSE events. `path` starts with `/`. */
async function streamSSE(
  path: string,
  body: NoteGenerateRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      handlers.onError?.("Could not reach the generation service.");
    }
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError?.(`Generation failed (HTTP ${res.status}).`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        dispatchFrame(frame, handlers);
      }
    }
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      handlers.onError?.("Stream interrupted.");
    }
  }
}

function dispatchFrame(frame: string, handlers: StreamHandlers): void {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;

  let payload: unknown;
  try {
    payload = JSON.parse(dataLines.join("\n"));
  } catch {
    return;
  }

  switch (event) {
    case "meta":
      handlers.onMeta?.(payload as MetaEvent);
      break;
    case "delta":
      handlers.onDelta?.((payload as { text: string }).text);
      break;
    case "done":
      handlers.onDone?.(payload as DoneEvent);
      break;
    case "error":
      handlers.onError?.((payload as { message: string }).message);
      break;
  }
}

export function streamGenerate(
  vaultId: string,
  body: NoteGenerateRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  return streamSSE(`/vaults/${vaultId}/notes/generate`, body, handlers, signal);
}

export function streamRegenerate(
  noteId: string,
  body: NoteGenerateRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  return streamSSE(`/notes/${noteId}/regenerate`, body, handlers, signal);
}
