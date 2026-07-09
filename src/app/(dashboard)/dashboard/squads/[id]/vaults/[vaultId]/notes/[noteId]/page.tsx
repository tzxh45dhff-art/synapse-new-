"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Loader2, Pencil, RotateCcw, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MarkdownViewer } from "@/components/notes/markdown-viewer";
import { NoteEditor } from "@/components/notes/note-editor";
import { OutlineSidebar } from "@/components/notes/outline-sidebar";
import { VersionTimeline } from "@/components/notes/version-timeline";
import { ExportMenu } from "@/components/notes/export-menu";
import { getNote, listVersions } from "@/app/actions/notes/queries";
import { restoreVersion, updateNote } from "@/app/actions/notes/mutations";
import { streamRegenerate } from "@/lib/notes-stream";
import {
  DEFAULT_SETTINGS,
  type GenerationMode,
  type NoteDetail,
  type NoteGenerationSettings,
  type NoteVersion,
  type RetrievalMode,
} from "@/types/notes";

interface Props {
  params: Promise<{ id: string; vaultId: string; noteId: string }>;
}

type Tab = "read" | "edit";
type SaveState = "idle" | "saving" | "saved";

export default function NoteDetailPage({ params }: Props) {
  const { id: squadId, vaultId, noteId } = use(params);

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("read");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [restoring, setRestoring] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [n, v] = await Promise.all([getNote(noteId), listVersions(noteId)]);
      setNote(n);
      setContent(n.content);
      setTitle(n.title);
      setVersions(v);
    } catch {
      toast.error("Failed to load note.");
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => { load(); }, [load]);

  // Debounced autosave of content while editing.
  useEffect(() => {
    if (!note || content === note.content) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const updated = await updateNote(noteId, squadId, vaultId, {
          content,
          change_summary: "Manual edit",
        });
        setNote(updated);
        setSaveState("saved");
        listVersions(noteId).then(setVersions).catch(() => {});
        setTimeout(() => setSaveState("idle"), 1500);
      } catch {
        setSaveState("idle");
        toast.error("Autosave failed.");
      }
    }, 1200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [content, note, noteId, squadId, vaultId]);

  async function saveTitle() {
    if (!note || title.trim() === note.title || !title.trim()) return;
    try {
      const updated = await updateNote(noteId, squadId, vaultId, { title: title.trim() });
      setNote(updated);
    } catch {
      toast.error("Failed to rename note.");
    }
  }

  async function handleRestore(versionId: string) {
    setRestoring(versionId);
    try {
      const updated = await restoreVersion(noteId, versionId, squadId, vaultId);
      setNote(updated);
      setContent(updated.content);
      setVersions(await listVersions(noteId));
      toast.success("Version restored.");
    } catch {
      toast.error("Failed to restore version.");
    } finally {
      setRestoring(null);
    }
  }

  async function handleRegenerate() {
    if (!note) return;
    setRegenerating(true);
    setTab("read");
    setContent("");
    const controller = new AbortController();
    abortRef.current = controller;

    const meta = note.metadata as {
      mode?: GenerationMode;
      retrieval_mode?: RetrievalMode;
      settings?: NoteGenerationSettings;
    };

    await streamRegenerate(
      noteId,
      {
        mode: meta.mode ?? "full_notes",
        retrieval_mode: meta.retrieval_mode ?? "vault",
        settings: meta.settings ?? DEFAULT_SETTINGS,
      },
      {
        onDelta: (t) => setContent((prev) => prev + t),
        onDone: async () => {
          setRegenerating(false);
          abortRef.current = null;
          await load();
          toast.success("Regenerated.");
        },
        onError: (msg) => {
          setRegenerating(false);
          abortRef.current = null;
          toast.error(msg);
          load();
        },
      },
      controller.signal,
    );
  }

  function cancelRegenerate() {
    abortRef.current?.abort();
    abortRef.current = null;
    setRegenerating(false);
    load();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-[500px] w-full rounded-2xl" />
      </div>
    );
  }
  if (!note) return null;

  const base = `/dashboard/squads/${squadId}/vaults/${vaultId}/notes`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={base} className="text-zinc-500 transition-colors hover:text-zinc-200">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          className="flex-1 bg-transparent text-xl font-semibold text-white outline-none"
        />
        <div className="flex items-center gap-2">
          {saveState !== "idle" && (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              {saveState === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {saveState === "saving" ? "Saving…" : "Saved"}
            </span>
          )}
          {regenerating ? (
            <Button onClick={cancelRegenerate} variant="outline" size="sm" className="gap-2 border-white/10">
              <StopCircle className="h-4 w-4" /> Stop
            </Button>
          ) : (
            <Button onClick={handleRegenerate} variant="outline" size="sm" className="gap-2 border-white/10">
              <RotateCcw className="h-4 w-4" /> Regenerate
            </Button>
          )}
          <ExportMenu noteId={note.id} title={note.title} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {([["read", "Read", BookOpen], ["edit", "Edit", Pencil]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            disabled={regenerating}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300",
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
        {/* Main */}
        <div>
          {regenerating && (
            <div className="mb-3 flex items-center gap-2 text-sm text-indigo-300">
              <Loader2 className="h-4 w-4 animate-spin" /> Regenerating live…
            </div>
          )}
          {tab === "read" ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6">
              <MarkdownViewer content={content} />
            </div>
          ) : (
            <NoteEditor value={content} onChange={setContent} />
          )}
        </div>

        {/* Right rail */}
        <aside className="space-y-6">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
            <OutlineSidebar content={content} />
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
            <VersionTimeline versions={versions} onRestore={handleRestore} restoring={restoring} />
          </div>
        </aside>
      </div>
    </div>
  );
}
