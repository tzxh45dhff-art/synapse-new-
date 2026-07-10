"use client";

import { createClient } from "@/lib/supabase/client";
import type { ChatDoneEvent, ChatMetaEvent } from "@/types/chat";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export interface ChatStreamHandlers {
  onMeta?: (meta: ChatMetaEvent) => void;
  onDelta?: (text: string) => void;
  onDone?: (done: ChatDoneEvent) => void;
  onError?: (message: string) => void;
}

/** POST a chat message and dispatch SSE events. Mirrors notes-stream.ts. */
export async function streamChatMessage(
  sessionId: string,
  content: string,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/v1/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      body: JSON.stringify({ content }),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      handlers.onError?.("Could not reach the chat service.");
    }
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError?.(`Chat failed (HTTP ${res.status}).`);
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

function dispatchFrame(frame: string, handlers: ChatStreamHandlers): void {
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
      handlers.onMeta?.(payload as ChatMetaEvent);
      break;
    case "delta":
      handlers.onDelta?.((payload as { text: string }).text);
      break;
    case "done":
      handlers.onDone?.(payload as ChatDoneEvent);
      break;
    case "error":
      handlers.onError?.((payload as { message: string }).message);
      break;
  }
}
