"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessageBubble } from "./chat-message-bubble";
import { streamChatMessage } from "@/lib/chat-stream";
import { createChatSession } from "@/app/actions/chat/mutations";
import { getChatMessages } from "@/app/actions/chat/queries";
import type { ChatMessage } from "@/types/chat";

const SESSION_STORAGE_KEY = "bunker:chat:sessionId";

interface AskAiDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AskAiDrawer({ open, onOpenChange }: AskAiDrawerProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSessionId(localStorage.getItem(SESSION_STORAGE_KEY));
  }, []);

  useEffect(() => {
    if (!open || historyLoaded || !sessionId) return;
    setHistoryLoaded(true);
    getChatMessages(sessionId)
      .then(setMessages)
      .catch(() => {
        // Session may be stale (e.g. removed server-side) — start fresh silently.
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setSessionId(null);
      });
  }, [open, historyLoaded, sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function handleNewChat() {
    abortRef.current?.abort();
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionId(null);
    setMessages([]);
    setHistoryLoaded(true); // nothing to load for a fresh session
    setInput("");
    setIsStreaming(false);
  }

  async function handleSend() {
    const content = input.trim();
    if (!content || isStreaming) return;
    setInput("");

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      try {
        const session = await createChatSession();
        activeSessionId = session.id;
        setSessionId(session.id);
        setHistoryLoaded(true);
        localStorage.setItem(SESSION_STORAGE_KEY, session.id);
      } catch {
        toast.error("Couldn't start a chat session. Please try again.");
        setInput(content);
        return;
      }
    }

    const userMessageId = `local-user-${Date.now()}`;
    const assistantMessageId = `local-assistant-${Date.now()}`;
    const nowIso = new Date().toISOString();

    setMessages((prev) => [
      ...prev,
      { id: userMessageId, session_id: activeSessionId!, role: "user", content, created_at: nowIso, citations: [] },
      { id: assistantMessageId, session_id: activeSessionId!, role: "assistant", content: "", created_at: nowIso, citations: [] },
    ]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    await streamChatMessage(
      activeSessionId,
      content,
      {
        onMeta: (meta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessageId ? { ...m, citations: meta.citations } : m)),
          );
        },
        onDelta: (text) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessageId ? { ...m, content: m.content + text } : m)),
          );
        },
        onDone: (done) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessageId ? { ...m, id: done.message_id } : m)),
          );
          setIsStreaming(false);
        },
        onError: (message) => {
          toast.error(message);
          setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
          setIsStreaming(false);
        },
      },
      controller.signal,
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const lastMessageId = messages.length ? messages[messages.length - 1].id : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-white/[0.08] bg-[#0d0b16]/95 p-0 backdrop-blur-xl sm:max-w-md"
      >
        <SheetHeader className="flex-row items-center justify-between gap-2 border-b border-white/[0.06] p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <SheetTitle className="text-white">Ask AI</SheetTitle>
          </div>
          <button
            type="button"
            onClick={handleNewChat}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" /> New chat
          </button>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <Sparkles className="h-6 w-6 text-violet-400/60" />
              <p className="text-sm text-white/40">Ask anything about your vaults.</p>
              <p className="text-xs text-white/25">
                I&apos;ll search across every vault you have access to and cite my sources.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <ChatMessageBubble
                key={m.id}
                message={m}
                isStreaming={isStreaming && m.id === lastMessageId && m.role === "assistant"}
                onNavigate={() => onOpenChange(false)}
              />
            ))
          )}
        </div>

        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-end gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about anything in your vaults…"
              disabled={isStreaming}
              className="min-h-9 flex-1 resize-none border-none bg-transparent px-1 py-1.5 text-sm text-white placeholder:text-white/30 focus-visible:ring-0"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isStreaming || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
