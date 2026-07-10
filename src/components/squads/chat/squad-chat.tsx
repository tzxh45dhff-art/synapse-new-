"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Loader2, MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MessageBubble } from "./message-bubble";
import { MessageComposer } from "./message-composer";
import {
  deleteMessage as apiDelete,
  sendMessage as apiSend,
  toggleReaction as apiToggleReaction,
} from "@/app/actions/squads/chat/mutations";
import { getMessage, getMessages } from "@/app/actions/squads/chat/queries";
import type { MemberProfile } from "@/types/squad";
import type {
  ChatSignal,
  MessagePage,
  SendMessagePayload,
  SquadMessage,
} from "@/types/squad-chat";

const GROUP_GAP_MS = 5 * 60 * 1000;
const TYPING_TTL_MS = 3500;

interface Props {
  squadId: string;
  currentUser: MemberProfile;
  canSend: boolean;
  canModerate: boolean;
  initialPage: MessagePage;
}

function currentName(u: MemberProfile): string {
  return u.display_name || u.full_name || u.email;
}

export function SquadChat({ squadId, currentUser, canSend, canModerate, initialPage }: Props) {
  const [messages, setMessages] = useState<SquadMessage[]>(initialPage.messages);
  const [hasMore, setHasMore] = useState(initialPage.has_more);
  const [nextBefore, setNextBefore] = useState(initialPage.next_before);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyTo, setReplyTo] = useState<SquadMessage | null>(null);
  const [typing, setTyping] = useState<Record<string, string>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const stickToBottom = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // ── merge helpers ──────────────────────────────────────────────────────
  const upsert = useCallback((msg: SquadMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx === -1) return [...prev, msg];
      const next = [...prev];
      next[idx] = msg;
      return next;
    });
  }, []);

  // ── realtime (Supabase broadcast — DB-topology independent) ─────────────
  const onSignal = useCallback(
    async (signal: ChatSignal) => {
      if (signal.kind === "typing") {
        if (signal.user_id === currentUser.id) return;
        setTyping((prev) => ({ ...prev, [signal.user_id]: signal.name }));
        clearTimeout(typingTimers.current[signal.user_id]);
        typingTimers.current[signal.user_id] = setTimeout(() => {
          setTyping((prev) => {
            const next = { ...prev };
            delete next[signal.user_id];
            return next;
          });
        }, TYPING_TTL_MS);
        return;
      }

      if (signal.kind === "new") {
        if (signal.sender_id === currentUser.id) return; // already have it locally
        try {
          const msg = await getMessage(squadId, signal.id);
          upsert(msg);
        } catch {
          /* ignore — will appear on next reload */
        }
        return;
      }

      // update (reaction / delete / edit)
      try {
        const msg = await getMessage(squadId, signal.id);
        upsert(msg);
      } catch {
        /* ignore */
      }
    },
    [squadId, currentUser.id, upsert],
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`squad-chat:${squadId}`, {
      config: { broadcast: { self: false } },
    });
    channel.on("broadcast", { event: "signal" }, ({ payload }) => onSignal(payload as ChatSignal));
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [squadId, onSignal]);

  const broadcast = useCallback((signal: ChatSignal) => {
    channelRef.current?.send({ type: "broadcast", event: "signal", payload: signal });
  }, []);

  // ── initial + new-message autoscroll ─────────────────────────────────────
  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stickToBottom.current) scrollToBottom("smooth");
  }, [messages, scrollToBottom]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  // ── load older ────────────────────────────────────────────────────────
  async function loadOlder() {
    if (!hasMore || loadingOlder || !nextBefore) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const page = await getMessages(squadId, nextBefore);
      setMessages((prev) => [...page.messages, ...prev]);
      setHasMore(page.has_more);
      setNextBefore(page.next_before);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch {
      toast.error("Couldn't load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  }

  // ── send ────────────────────────────────────────────────────────────────
  async function handleSend(payload: SendMessagePayload) {
    const tempId = `temp-${Date.now()}`;
    const optimistic: SquadMessage = {
      id: tempId,
      squad_id: squadId,
      sender_id: currentUser.id,
      sender: currentUser,
      content: payload.content ?? "",
      message_type: payload.message_type ?? "text",
      attachment:
        (payload.file as unknown as Record<string, unknown>) ??
        (payload.shared as unknown as Record<string, unknown>) ??
        null,
      reply_to: replyTo
        ? {
            id: replyTo.id,
            sender_id: replyTo.sender_id,
            sender_name: replyTo.sender ? currentNameOf(replyTo) : null,
            content: replyTo.content,
            message_type: replyTo.message_type,
            deleted: replyTo.deleted,
          }
        : null,
      reactions: [],
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted: false,
    };
    stickToBottom.current = true;
    setMessages((prev) => [...prev, optimistic]);

    try {
      const real = await apiSend(squadId, payload);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m)));
      broadcast({ kind: "new", id: real.id, sender_id: currentUser.id });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("Message failed to send.");
    }
  }

  // ── reactions ─────────────────────────────────────────────────────────
  async function handleToggleReaction(messageId: string, emoji: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? applyReaction(m, emoji, currentUser.id) : m)),
    );
    try {
      await apiToggleReaction(squadId, messageId, emoji);
      broadcast({ kind: "update", id: messageId });
    } catch {
      try {
        upsert(await getMessage(squadId, messageId));
      } catch {
        /* ignore */
      }
      toast.error("Couldn't react.");
    }
  }

  // ── delete ────────────────────────────────────────────────────────────
  async function handleDelete(message: SquadMessage) {
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, deleted: true, content: "", attachment: null } : m)),
    );
    try {
      await apiDelete(squadId, message.id);
      broadcast({ kind: "update", id: message.id });
    } catch {
      try {
        upsert(await getMessage(squadId, message.id));
      } catch {
        /* ignore */
      }
      toast.error("Couldn't delete message.");
    }
  }

  function handleTyping() {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    broadcast({ kind: "typing", user_id: currentUser.id, name: currentName(currentUser) });
  }

  const typingNames = Object.values(typing);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto py-3">
        {hasMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-white/60 hover:bg-white/[0.06]"
            >
              {loadingOlder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Load older messages"}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/30">
            <MessagesSquare className="h-10 w-10" />
            <p className="text-sm">No messages yet. Say hello 👋</p>
          </div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showHeader =
            !prev ||
            prev.sender_id !== m.sender_id ||
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > GROUP_GAP_MS;
          return (
            <MessageBubble
              key={m.id}
              message={m}
              squadId={squadId}
              currentUserId={currentUser.id}
              isOwn={m.sender_id === currentUser.id}
              showHeader={showHeader}
              canModerate={canModerate}
              onReply={setReplyTo}
              onDelete={handleDelete}
              onToggleReaction={handleToggleReaction}
            />
          );
        })}
      </div>

      {typingNames.length > 0 && (
        <div className="px-4 py-1 text-xs italic text-white/40">
          {typingNames.length === 1
            ? `${typingNames[0]} is typing…`
            : `${typingNames.length} people are typing…`}
        </div>
      )}

      <MessageComposer
        squadId={squadId}
        disabled={!canSend}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={handleSend}
        onTyping={handleTyping}
      />
    </div>
  );
}

// ── pure helpers ──────────────────────────────────────────────────────────

function currentNameOf(m: SquadMessage): string | null {
  if (!m.sender) return null;
  return m.sender.display_name || m.sender.full_name || m.sender.email;
}

function applyReaction(m: SquadMessage, emoji: string, userId: string): SquadMessage {
  const reactions = m.reactions.map((r) => ({ ...r, user_ids: [...r.user_ids] }));
  const entry = reactions.find((r) => r.emoji === emoji);
  if (entry) {
    if (entry.user_ids.includes(userId)) {
      entry.user_ids = entry.user_ids.filter((id) => id !== userId);
      entry.count = entry.user_ids.length;
    } else {
      entry.user_ids.push(userId);
      entry.count = entry.user_ids.length;
    }
  } else {
    reactions.push({ emoji, count: 1, user_ids: [userId] });
  }
  return { ...m, reactions: reactions.filter((r) => r.count > 0) };
}
