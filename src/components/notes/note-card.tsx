"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Sparkles, Pencil, Pin, MoreHorizontal, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NoteListItem } from "@/types/notes";

const SOURCE_META: Record<string, { label: string; icon: typeof Sparkles; cls: string }> = {
  ai_generated: { label: "AI", icon: Sparkles, cls: "text-indigo-300 bg-indigo-500/15" },
  hybrid: { label: "Hybrid", icon: Sparkles, cls: "text-violet-300 bg-violet-500/15" },
  manual: { label: "Manual", icon: Pencil, cls: "text-zinc-400 bg-white/[0.06]" },
};

interface Props {
  note: NoteListItem;
  href: string;
  index?: number;
  onTogglePin?: (id: string, pinned: boolean) => void;
  onDelete?: (id: string) => void;
}

export function NoteCard({ note, href, index = 0, onTogglePin, onDelete }: Props) {
  const meta = SOURCE_META[note.source_type] ?? SOURCE_META.manual;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="group relative flex items-center gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3.5 transition-all duration-150 hover:border-white/[0.1] hover:bg-white/[0.04]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.05]">
        <FileText className="h-5 w-5 text-zinc-400" />
      </div>

      <Link href={href} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-white">{note.title}</p>
          {note.is_pinned && <Pin className="h-3 w-3 shrink-0 text-amber-400" />}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5", meta.cls)}>
            <meta.icon className="h-2.5 w-2.5" /> {meta.label}
          </span>
          <span className="text-zinc-700">·</span>
          <span>{note.word_count.toLocaleString()} words</span>
          <span className="text-zinc-700">·</span>
          <span>{formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}</span>
        </div>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-600 opacity-0 transition-opacity hover:bg-white/[0.08] hover:text-white group-hover:opacity-100">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 border-white/[0.08] bg-zinc-900 text-white">
          <DropdownMenuItem onClick={() => onTogglePin?.(note.id, !note.is_pinned)} className="gap-2 hover:bg-white/[0.06]">
            <Pin className="h-3.5 w-3.5" /> {note.is_pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete?.(note.id)} className="gap-2 text-red-400 hover:bg-red-950/40">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}
