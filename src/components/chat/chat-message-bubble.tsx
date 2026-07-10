"use client";

import { Sparkles, User } from "lucide-react";
import { MarkdownViewer } from "@/components/notes/markdown-viewer";
import { ChatReferenceCard } from "./chat-reference-card";
import type { ChatMessage } from "@/types/chat";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onNavigate?: () => void;
}

export function ChatMessageBubble({ message, isStreaming, onNavigate }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-white/10 text-white/70" : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div className={`flex max-w-[85%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm ${
            isUser ? "bg-violet-600/90 text-white" : "border border-white/[0.06] bg-white/[0.03] text-white/90"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : message.content ? (
            <>
              <MarkdownViewer content={message.content} />
              {isStreaming && (
                <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse bg-white/50 align-middle" />
              )}
            </>
          ) : (
            isStreaming && <TypingDots />
          )}
        </div>
        {!isUser && message.citations.length > 0 && (
          <div className="flex w-full flex-col gap-1.5">
            {message.citations.map((c) => (
              <ChatReferenceCard key={`${c.chunk_id}-${c.index}`} citation={c} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40"
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </span>
  );
}
