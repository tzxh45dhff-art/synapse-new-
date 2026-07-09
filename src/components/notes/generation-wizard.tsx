"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles, Loader2, StopCircle, RotateCcw, FileStack,
  Layers, FileText, BookOpen, Check, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { MarkdownViewer } from "@/components/notes/markdown-viewer";
import { GenerationSettingsPanel } from "@/components/notes/generation-settings";
import { streamGenerate } from "@/lib/notes-stream";
import {
  DEFAULT_SETTINGS,
  type Citation,
  type GenerationMode,
  type GenerationUsage,
  type NoteGenerateRequest,
  type NoteGenerationSettings,
  type PromptTemplate,
  type RetrievalMode,
} from "@/types/notes";
import type { ResourceListItem } from "@/types/vault";

interface Props {
  vaultId: string;
  squadId: string;
  resources: ResourceListItem[];
  templates: PromptTemplate[];
}

type Status = "idle" | "generating" | "done" | "error";

const RETRIEVAL_OPTIONS: { value: RetrievalMode; label: string; icon: typeof Layers; hint: string }[] = [
  { value: "vault", label: "Entire vault", icon: Layers, hint: "Search across all AI-ready resources" },
  { value: "resources", label: "Selected resources", icon: FileStack, hint: "Pick specific documents" },
  { value: "chapters", label: "Chapters", icon: BookOpen, hint: "Target headings within documents" },
  { value: "pages", label: "Pages", icon: FileText, hint: "Target specific pages of one document" },
];

function parsePages(input: string): number[] {
  const out = new Set<number>();
  for (const part of input.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(p);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])];
      for (let n = Math.min(a, b); n <= Math.max(a, b); n++) out.add(n);
    } else if (/^\d+$/.test(p)) {
      out.add(Number(p));
    }
  }
  return [...out].sort((x, y) => x - y);
}

export function GenerationWizard({ vaultId, squadId, resources, templates }: Props) {
  const router = useRouter();
  const aiReady = resources.filter((r) => r.is_ai_ready);

  const [mode, setMode] = useState<GenerationMode>("full_notes");
  const [retrieval, setRetrieval] = useState<RetrievalMode>("vault");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [pageResource, setPageResource] = useState<string>("");
  const [pagesInput, setPagesInput] = useState("");
  const [chaptersInput, setChaptersInput] = useState("");
  const [settings, setSettings] = useState<NoteGenerationSettings>(DEFAULT_SETTINGS);

  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [usage, setUsage] = useState<GenerationUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleExportPDF() {
    if (!noteId) return;
    setDownloading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
      const res = await fetch(`${BACKEND_URL}/api/v1/notes/${noteId}/export?format=pdf`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "Generated Note").replace(/[^a-z0-9 \-_]/gi, "_") || "note"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded successfully!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setDownloading(false);
    }
  }


  function toggleResource(id: string) {
    setSelectedResources((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function buildRequest(): NoteGenerateRequest {
    return {
      mode,
      retrieval_mode: retrieval,
      title: title.trim() || null,
      query: query.trim() || null,
      resource_ids: retrieval === "resources" || retrieval === "chapters" ? selectedResources : [],
      page_resource_id: retrieval === "pages" ? pageResource || null : null,
      pages: retrieval === "pages" ? parsePages(pagesInput) : [],
      chapters: retrieval === "chapters"
        ? chaptersInput.split(",").map((c) => c.trim()).filter(Boolean)
        : [],
      settings,
    };
  }

  async function handleGenerate() {
    setStatus("generating");
    setText("");
    setCitations([]);
    setUsage(null);
    setError(null);
    setNoteId(null);

    const controller = new AbortController();
    abortRef.current = controller;

    await streamGenerate(
      vaultId,
      buildRequest(),
      {
        onMeta: (m) => setCitations(m.citations),
        onDelta: (t) => setText((prev) => prev + t),
        onDone: (d) => {
          setUsage(d.generation);
          setNoteId(d.note_id);
          setStatus("done");
        },
        onError: (msg) => {
          setError(msg);
          setStatus("error");
        },
      },
      controller.signal,
    );
    if (abortRef.current === controller && status === "generating") {
      // stream ended without done/error (e.g. aborted)
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus(text ? "done" : "idle");
  }

  const canGenerate =
    status !== "generating" &&
    (retrieval === "vault"
      ? aiReady.length > 0
      : retrieval === "resources"
        ? selectedResources.length > 0
        : retrieval === "chapters"
          ? selectedResources.length > 0 && chaptersInput.trim().length > 0
          : pageResource !== "" && pagesInput.trim().length > 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      {/* ── Config panel ── */}
      <div className="space-y-6">
        {/* Mode */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Note type</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {templates.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setMode(t.key)}
                title={t.description}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors",
                  mode === t.key
                    ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
                    : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/[0.12] hover:text-zinc-200",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* Source */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Source</h3>
          <div className="space-y-1.5">
            {RETRIEVAL_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setRetrieval(o.value)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                  retrieval === o.value
                    ? "border-indigo-500/50 bg-indigo-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]",
                )}
              >
                <o.icon className={cn("h-4 w-4 shrink-0", retrieval === o.value ? "text-indigo-300" : "text-zinc-500")} />
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", retrieval === o.value ? "text-white" : "text-zinc-300")}>{o.label}</p>
                  <p className="truncate text-xs text-zinc-500">{o.hint}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Selection detail */}
        {(retrieval === "resources" || retrieval === "chapters") && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Choose resources ({selectedResources.length})
            </h3>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/[0.06] p-1.5">
              {aiReady.length === 0 && <p className="p-2 text-xs text-zinc-600">No AI-ready resources yet.</p>}
              {aiReady.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleResource(r.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/[0.04]"
                >
                  <span className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border",
                    selectedResources.includes(r.id) ? "border-indigo-500 bg-indigo-500" : "border-white/20",
                  )}>
                    {selectedResources.includes(r.id) && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span className="truncate">{r.title}</span>
                </button>
              ))}
            </div>
            {retrieval === "chapters" && (
              <input
                value={chaptersInput}
                onChange={(e) => setChaptersInput(e.target.value)}
                placeholder="Chapter / heading names, comma-separated"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-500/50"
              />
            )}
          </section>
        )}

        {retrieval === "pages" && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Document & pages</h3>
            <select
              value={pageResource}
              onChange={(e) => setPageResource(e.target.value)}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-500/50"
            >
              <option value="">Select a document…</option>
              {aiReady.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
            <input
              value={pagesInput}
              onChange={(e) => setPagesInput(e.target.value)}
              placeholder="Pages e.g. 1, 3, 5-8"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-500/50"
            />
          </section>
        )}

        {/* Focus + title */}
        <section className="space-y-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Focus topic (optional)"
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500/50"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title (optional)"
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500/50"
          />
        </section>

        {/* Settings */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Settings</h3>
          <GenerationSettingsPanel settings={settings} onChange={setSettings} />
        </section>

        {/* Actions */}
        <div className="flex gap-2">
          {status === "generating" ? (
            <Button onClick={handleCancel} variant="outline" className="flex-1 gap-2 border-white/10">
              <StopCircle className="h-4 w-4" /> Cancel
            </Button>
          ) : (
            <Button onClick={handleGenerate} disabled={!canGenerate} className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-500">
              {status === "done" ? <RotateCcw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {status === "done" ? "Regenerate" : "Generate notes"}
            </Button>
          )}
        </div>
      </div>

      {/* ── Preview panel ── */}
      <div className="min-h-[400px] rounded-2xl border border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            {status === "generating" && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
            <span>
              {status === "idle" && "Preview"}
              {status === "generating" && "Generating…"}
              {status === "done" && "Complete"}
              {status === "error" && "Error"}
            </span>
          </div>
          {usage && (
            <span className="text-xs text-zinc-600">
              {usage.total_tokens.toLocaleString()} tokens · ${usage.cost_usd.toFixed(4)} · {usage.latency_ms}ms
            </span>
          )}
        </div>

        <div className="p-5">
          {status === "error" && (
            <div className="rounded-lg border border-red-500/20 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {status === "idle" && !text && (
            <div className="flex h-72 flex-col items-center justify-center text-center text-zinc-600">
              <Sparkles className="mb-3 h-8 w-8 text-zinc-700" />
              <p className="text-sm">Configure your notes and hit Generate.</p>
              <p className="mt-1 text-xs">Notes stream in live and are grounded in your vault.</p>
            </div>
          )}

          {(text || status === "generating") && (
            <MarkdownViewer content={text || "…"} />
          )}

          {citations.length > 0 && (
            <div className="mt-6 border-t border-white/[0.06] pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Sources ({citations.length})
              </p>
              <div className="space-y-1.5">
                {citations.map((c) => (
                  <div key={c.index} className="flex items-start gap-2 text-xs text-zinc-500">
                    <span className="mt-0.5 rounded bg-indigo-500/15 px-1.5 text-indigo-300">{c.index}</span>
                    <span className="min-w-0">
                      <span className="text-zinc-300">{c.resource_title}</span>
                      {c.page_number != null && <span> · p.{c.page_number}</span>}
                      {c.heading && <span> · {c.heading}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {status === "done" && noteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-3"
          >
            <Button
              onClick={handleExportPDF}
              disabled={downloading}
              variant="outline"
              className="gap-2 border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06] hover:text-white"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PDF
            </Button>
            <Button
              onClick={() => router.push(`/dashboard/squads/${squadId}/vaults/${vaultId}/notes/${noteId}`)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Open note →
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
