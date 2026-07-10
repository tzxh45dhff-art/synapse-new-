"use client";

import { useRef, useState } from "react";
import { Send, Paperclip, X, Loader2, FolderOpen, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getChatUploadUrl } from "@/app/actions/squads/chat/mutations";
import { SharePicker } from "./share-picker";
import type { SendMessagePayload, SquadMessage } from "@/types/squad-chat";

const MAX_FILE_MB = 50;

interface Props {
  squadId: string;
  disabled: boolean;
  replyTo: SquadMessage | null;
  onCancelReply: () => void;
  onSend: (payload: SendMessagePayload) => void;
  onTyping: () => void;
}

export function MessageComposer({
  squadId,
  disabled,
  replyTo,
  onCancelReply,
  onSend,
  onTyping,
}: Props) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function submitText() {
    const content = text.trim();
    if (!content) return;
    onSend({ content, reply_to_id: replyTo?.id });
    setText("");
    onCancelReply();
  }

  async function handleFile(file: File) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`File exceeds ${MAX_FILE_MB} MB limit.`);
      return;
    }
    setUploading(true);
    try {
      const { upload_url, storage_path } = await getChatUploadUrl(
        squadId,
        file.name,
        file.type || "application/octet-stream",
        file.size,
      );
      const put = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error("upload failed");
      onSend({
        content: text.trim(),
        message_type: "file",
        file: {
          storage_path,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
        },
        reply_to_id: replyTo?.id,
      });
      setText("");
      onCancelReply();
    } catch {
      toast.error("Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (disabled) {
    return (
      <div className="border-t border-white/[0.06] px-4 py-3 text-center text-xs text-white/40">
        Viewers can read this chat but cannot send messages.
      </div>
    );
  }

  return (
    <div className="border-t border-white/[0.06] bg-white/[0.02]">
      {replyTo && (
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
          <div className="min-w-0 border-l-2 border-violet-400/60 pl-2">
            <p className="text-xs font-medium text-violet-300/80">
              Replying to {replyTo.sender?.display_name || replyTo.sender?.full_name || replyTo.sender?.email || "message"}
            </p>
            <p className="truncate text-xs text-white/50">
              {replyTo.content || `[${replyTo.message_type}]`}
            </p>
          </div>
          <button onClick={onCancelReply} className="rounded-full p-1 text-white/40 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-3">
        <Popover>
          <PopoverTrigger asChild>
            <button
              disabled={uploading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white/80 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start" side="top">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-white/80 transition-colors hover:bg-white/[0.06]"
            >
              <Upload className="h-4 w-4 text-violet-300" /> Upload a file
            </button>
            <button
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-white/80 transition-colors hover:bg-white/[0.06]"
            >
              <FolderOpen className="h-4 w-4 text-sky-300" /> Share note or resource
            </button>
          </PopoverContent>
        </Popover>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitText();
            }
          }}
          rows={1}
          placeholder="Type a message…"
          className="max-h-32 min-h-[2.25rem] flex-1 resize-none rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-violet-500/50 focus:outline-none"
        />

        <button
          onClick={submitText}
          disabled={!text.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <SharePicker
        squadId={squadId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onShare={(type, shared) =>
          onSend({ content: text.trim(), message_type: type, shared, reply_to_id: replyTo?.id })
        }
      />
    </div>
  );
}
