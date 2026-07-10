"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Download, Reply, Trash2, SmilePlus, StickyNote, File } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getChatAttachmentUrl } from "@/app/actions/squads/chat/mutations";
import type { FileAttachment, SharedAttachment, SquadMessage } from "@/types/squad-chat";

const REACTION_CHOICES = ["👍", "❤️", "😂", "🔥", "🎉", "😮"];

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function displayName(m: SquadMessage): string {
  return (
    m.sender?.display_name ||
    m.sender?.full_name ||
    m.sender?.email ||
    "Unknown"
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  message: SquadMessage;
  squadId: string;
  currentUserId: string;
  isOwn: boolean;
  showHeader: boolean;
  canModerate: boolean;
  onReply: (m: SquadMessage) => void;
  onDelete: (m: SquadMessage) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
}

export function MessageBubble({
  message,
  squadId,
  currentUserId,
  isOwn,
  showHeader,
  canModerate,
  onReply,
  onDelete,
  onToggleReaction,
}: Props) {
  if (message.deleted) {
    return (
      <div className={cn("flex px-4 py-0.5", isOwn ? "justify-end" : "justify-start")}>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs italic text-white/30">
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex gap-2 px-4 py-0.5",
        isOwn ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* avatar gutter (kept for alignment even when hidden) */}
      <div className="w-8 shrink-0">
        {!isOwn && showHeader && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={message.sender?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-violet-500/20 text-[10px] text-violet-200">
              {initials(displayName(message))}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      <div className={cn("flex max-w-[78%] flex-col", isOwn ? "items-end" : "items-start")}>
        {showHeader && !isOwn && (
          <span className="mb-0.5 px-1 text-xs font-medium text-violet-300/80">
            {displayName(message)}
          </span>
        )}

        <div className={cn("flex items-end gap-1.5", isOwn ? "flex-row-reverse" : "flex-row")}>
          <div
            className={cn(
              "relative rounded-2xl px-3 py-2 text-sm shadow-sm",
              isOwn
                ? "rounded-br-md bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
                : "rounded-bl-md border border-white/[0.06] bg-white/[0.05] text-white/90",
            )}
          >
            {message.reply_to && <ReplyQuote reply={message.reply_to} own={isOwn} />}

            {message.message_type === "file" && (
              <FileAttachmentView
                squadId={squadId}
                attachment={message.attachment as unknown as FileAttachment}
              />
            )}
            {(message.message_type === "resource" || message.message_type === "note") && (
              <SharedAttachmentView
                squadId={squadId}
                kind={message.message_type}
                attachment={message.attachment as unknown as SharedAttachment}
              />
            )}

            {message.content && (
              <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
            )}

            <span
              className={cn(
                "mt-0.5 block text-right text-[10px]",
                isOwn ? "text-white/60" : "text-white/30",
              )}
            >
              {formatTime(message.created_at)}
            </span>
          </div>

          {/* hover actions */}
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Popover>
              <PopoverTrigger asChild>
                <button className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white/80">
                  <SmilePlus className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-full p-1" align={isOwn ? "end" : "start"}>
                <div className="flex gap-0.5">
                  {REACTION_CHOICES.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => onToggleReaction(message.id, emoji)}
                      className="rounded-full px-1.5 py-1 text-lg transition-transform hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <button
              onClick={() => onReply(message)}
              className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white/80"
            >
              <Reply className="h-4 w-4" />
            </button>

            {(isOwn || canModerate) && (
              <button
                onClick={() => onDelete(message)}
                className="rounded-full p-1 text-white/40 hover:bg-red-500/20 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {message.reactions.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", isOwn ? "justify-end" : "justify-start")}>
            {message.reactions.map((r) => {
              const mine = r.user_ids.includes(currentUserId);
              return (
                <button
                  key={r.emoji}
                  onClick={() => onToggleReaction(message.id, r.emoji)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                    mine
                      ? "border-violet-500/50 bg-violet-500/20 text-white"
                      : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08]",
                  )}
                >
                  <span>{r.emoji}</span>
                  <span className="tabular-nums">{r.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReplyQuote({ reply, own }: { reply: SquadMessage["reply_to"]; own: boolean }) {
  if (!reply) return null;
  return (
    <div
      className={cn(
        "mb-1.5 border-l-2 pl-2 text-xs",
        own ? "border-white/40" : "border-violet-400/60",
      )}
    >
      <span className={cn("font-medium", own ? "text-white/80" : "text-violet-300/80")}>
        {reply.sender_name ?? "Unknown"}
      </span>
      <p className={cn("truncate", own ? "text-white/60" : "text-white/50")}>
        {reply.deleted
          ? "deleted message"
          : reply.content || `[${reply.message_type}]`}
      </p>
    </div>
  );
}

function FileAttachmentView({
  squadId,
  attachment,
}: {
  squadId: string;
  attachment: FileAttachment;
}) {
  const isImage = attachment.mime_type?.startsWith("image/");
  const [url, setUrl] = useState<string | null>(null);

  const resolve = useCallback(async () => {
    if (url) return url;
    try {
      const res = await getChatAttachmentUrl(squadId, attachment.storage_path);
      setUrl(res.download_url);
      return res.download_url;
    } catch {
      toast.error("Couldn't load attachment.");
      return null;
    }
  }, [squadId, attachment.storage_path, url]);

  // Eagerly resolve the signed URL for images. setState happens only inside the
  // promise callback, never synchronously in the effect body.
  useEffect(() => {
    if (!isImage) return;
    let active = true;
    getChatAttachmentUrl(squadId, attachment.storage_path)
      .then((res) => {
        if (active) setUrl(res.download_url);
      })
      .catch(() => {
        /* leave placeholder; clicking retries */
      });
    return () => {
      active = false;
    };
  }, [isImage, squadId, attachment.storage_path]);

  if (isImage) {
    return (
      <div className="mb-1 overflow-hidden rounded-lg">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={attachment.file_name}
            className="max-h-72 w-full cursor-pointer rounded-lg object-cover"
            onClick={() => url && window.open(url, "_blank")}
          />
        ) : (
          <div className="flex h-40 w-56 items-center justify-center bg-white/[0.04] text-xs text-white/40">
            Loading…
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={async () => {
        const u = await resolve();
        if (u) window.open(u, "_blank");
      }}
      className="mb-1 flex w-56 items-center gap-2.5 rounded-lg border border-white/10 bg-black/20 p-2 text-left transition-colors hover:bg-black/30"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-500/20">
        <FileText className="h-4 w-4 text-violet-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{attachment.file_name}</p>
        <p className="text-[10px] text-white/40">
          {(attachment.size_bytes / 1024).toFixed(0)} KB
        </p>
      </div>
      <Download className="h-4 w-4 shrink-0 text-white/40" />
    </button>
  );
}

function SharedAttachmentView({
  squadId,
  kind,
  attachment,
}: {
  squadId: string;
  kind: "resource" | "note";
  attachment: SharedAttachment;
}) {
  const href =
    kind === "note"
      ? `/dashboard/squads/${squadId}/vaults/${attachment.vault_id}/notes/${attachment.ref_id}`
      : `/dashboard/squads/${squadId}/vaults/${attachment.vault_id}`;
  const Icon = kind === "note" ? StickyNote : File;

  return (
    <Link
      href={href}
      className="mb-1 flex w-60 items-center gap-2.5 rounded-lg border border-white/10 bg-black/20 p-2 transition-colors hover:bg-black/30"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-500/20">
        <Icon className="h-4 w-4 text-sky-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{attachment.title}</p>
        <p className="truncate text-[10px] uppercase tracking-wide text-white/40">
          {kind}
          {attachment.subtitle ? ` · ${attachment.subtitle}` : ""}
        </p>
      </div>
    </Link>
  );
}
