"use client";

import { formatDistanceToNow } from "date-fns";
import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NoteVersion } from "@/types/notes";

interface Props {
  versions: NoteVersion[];
  onRestore?: (versionId: string) => void;
  restoring?: string | null;
}

export function VersionTimeline({ versions, onRestore, restoring }: Props) {
  if (versions.length === 0) {
    return <p className="text-xs text-zinc-600">No versions yet.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        <History className="h-3.5 w-3.5" /> Versions
      </p>
      <ol className="relative space-y-3 border-l border-white/[0.08] pl-4">
        {versions.map((v, i) => (
          <li key={v.id} className="relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 bg-indigo-500" />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200">
                  v{v.version_number}
                  {i === 0 && <span className="ml-2 text-xs text-emerald-400">current</span>}
                </p>
                <p className="truncate text-xs text-zinc-500">{v.change_summary ?? "—"}</p>
                <p className="text-[11px] text-zinc-600">
                  {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                </p>
              </div>
              {i !== 0 && onRestore && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={restoring === v.id}
                  onClick={() => onRestore(v.id)}
                  className="h-7 gap-1 px-2 text-xs text-zinc-400 hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" /> Restore
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
