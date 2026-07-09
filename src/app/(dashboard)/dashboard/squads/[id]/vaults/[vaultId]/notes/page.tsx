"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NoteCard } from "@/components/notes/note-card";
import { listNotes } from "@/app/actions/notes/queries";
import { deleteNote, updateNote } from "@/app/actions/notes/mutations";
import type { NoteListItem } from "@/types/notes";

interface Props {
  params: Promise<{ id: string; vaultId: string }>;
}

export default function NotesDashboardPage({ params }: Props) {
  const { id: squadId, vaultId } = use(params);
  const base = `/dashboard/squads/${squadId}/vaults/${vaultId}/notes`;

  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchNotes = useCallback(async () => {
    try {
      setNotes(await listNotes(vaultId, { search: search || undefined }));
    } catch {
      toast.error("Failed to load notes.");
    } finally {
      setLoading(false);
    }
  }, [vaultId, search]);

  useEffect(() => {
    const t = setTimeout(fetchNotes, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchNotes, search]);

  async function handleDelete(id: string) {
    setNotes((n) => n.filter((x) => x.id !== id));
    try {
      await deleteNote(id, squadId, vaultId);
      toast.success("Note deleted.");
    } catch {
      toast.error("Failed to delete note.");
      fetchNotes();
    }
  }

  async function handleTogglePin(id: string, pinned: boolean) {
    setNotes((n) => n.map((x) => (x.id === id ? { ...x, is_pinned: pinned } : x)));
    try {
      await updateNote(id, squadId, vaultId, { is_pinned: pinned });
    } catch {
      toast.error("Failed to update note.");
      fetchNotes();
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/squads/${squadId}/vaults/${vaultId}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Vault
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Notes</h1>
          <p className="text-sm text-zinc-500">AI-generated and manual study notes for this vault.</p>
        </div>
        <Link href={`${base}/new`}>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-500">
            <Sparkles className="h-4 w-4" /> Generate notes
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
          className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] py-2.5 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-indigo-500/50"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-zinc-700" />
          <p className="text-sm font-medium text-zinc-300">No notes yet</p>
          <p className="mb-4 mt-1 text-xs text-zinc-500">Generate your first notes from this vault&apos;s resources.</p>
          <Link href={`${base}/new`}>
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-500">
              <Sparkles className="h-4 w-4" /> Generate notes
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n, i) => (
            <NoteCard
              key={n.id}
              note={n}
              index={i}
              href={`${base}/${n.id}`}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
