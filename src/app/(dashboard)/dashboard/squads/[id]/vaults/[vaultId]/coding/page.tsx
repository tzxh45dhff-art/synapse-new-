"use client";

import { use, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Terminal, AlertCircle, RotateCcw, Sparkles, ChevronRight, Clock, Trash2,
  BookOpen, CheckCircle2, CircleDashed, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { VaultHeader } from "@/components/vaults/vault-header";
import { CodingWizard } from "@/components/coding/coding-wizard";
import { CodingWorkspace } from "@/components/coding/coding-workspace";
import { getVault } from "@/app/actions/vaults/queries";
import { listResources } from "@/app/actions/resources/queries";
import { generateCodingQuestions, listCodingRuntimes } from "@/app/actions/coding/generate";
import { listCodingSets, getCodingSet, deleteCodingSet } from "@/app/actions/coding/sets";
import type { VaultDetail, ResourceListItem } from "@/types/vault";
import type {
  CodingQuestion, CodingGenerateRequest, CodingSetListItem, CodingRuntimeInfo, GradeStatus,
} from "@/types/coding";

interface Props {
  params: Promise<{ id: string; vaultId: string }>;
}

type Stage = "wizard" | "questions";

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  solve: { label: "Implement", bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400" },
  debug: { label: "Debug", bg: "bg-red-500/10 border-red-500/20", text: "text-red-400" },
  trace: { label: "Trace", bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-400" },
  fill:  { label: "Fill Blank", bg: "bg-yellow-500/10 border-yellow-500/20", text: "text-yellow-400" },
};

const DIFF_CONFIG: Record<string, { label: string; text: string }> = {
  easy:   { label: "Easy",   text: "text-green-400" },
  medium: { label: "Medium", text: "text-blue-400" },
  hard:   { label: "Hard",   text: "text-red-400" },
};

const DIFF_COLORS: Record<string, string> = {
  easy: "text-green-400",
  medium: "text-blue-400",
  hard: "text-red-400",
  mixed: "text-violet-400",
};

/** Solved state lives client-side, keyed by set, so progress survives a reload. */
const progressKey = (setId: string | null) => `bunker.coding.progress.${setId ?? "unsaved"}`;

function loadProgress(setId: string | null): Record<number, GradeStatus> {
  try {
    const raw = window.localStorage.getItem(progressKey(setId));
    return raw ? (JSON.parse(raw) as Record<number, GradeStatus>) : {};
  } catch {
    return {};
  }
}

export default function CodingQuestionsPage({ params }: Props) {
  const { id: squadId, vaultId } = use(params);

  // Vault data
  const [vault, setVault] = useState<VaultDetail | null>(null);
  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [loadingVault, setLoadingVault] = useState(true);
  const [runtimes, setRuntimes] = useState<CodingRuntimeInfo[]>([]);

  // Question state
  const [stage, setStage] = useState<Stage>("wizard");
  const [isPending, startTransition] = useTransition();
  const [questions, setQuestions] = useState<CodingQuestion[]>([]);
  const [generatedLanguage, setGeneratedLanguage] = useState("");
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<number, GradeStatus>>({});
  const [setWarnings, setSetWarnings] = useState<string[]>([]);

  // Saved sets
  const [savedSets, setSavedSets] = useState<CodingSetListItem[]>([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [loadingSetId, setLoadingSetId] = useState<string | null>(null);

  const solvedCount = useMemo(
    () => questions.filter((q) => progress[q.number] === "Accepted").length,
    [questions, progress],
  );

  const recordResult = useCallback(
    (questionNumber: number, status: GradeStatus) => {
      setProgress((prev) => {
        // Never downgrade a solved problem to a later failed experiment.
        if (prev[questionNumber] === "Accepted" && status !== "Accepted") return prev;
        const next = { ...prev, [questionNumber]: status };
        try {
          window.localStorage.setItem(progressKey(activeSetId), JSON.stringify(next));
        } catch {
          /* progress tracking is a convenience, not a contract */
        }
        return next;
      });
    },
    [activeSetId],
  );

  const fetchVaultData = useCallback(async () => {
    try {
      const [v, r] = await Promise.all([
        getVault(vaultId).catch(() => null),
        listResources(vaultId).catch(() => []),
      ]);
      setVault(v);
      setResources(r);
    } catch {
      toast.error("Failed to load vault details.");
    } finally {
      setLoadingVault(false);
    }
  }, [vaultId]);

  const fetchSavedSets = useCallback(async () => {
    try {
      const sets = await listCodingSets(vaultId);
      setSavedSets(sets);
    } catch {
      // Non-critical: don't block UI
    } finally {
      setLoadingSets(false);
    }
  }, [vaultId]);

  useEffect(() => {
    fetchVaultData();
    fetchSavedSets();
    listCodingRuntimes()
      .then(setRuntimes)
      .catch(() => {
        /* capability probe is advisory — the grader still works without it */
      });
  }, [fetchVaultData, fetchSavedSets]);

  function handleGenerate(data: CodingGenerateRequest) {
    startTransition(async () => {
      try {
        const response = await generateCodingQuestions(vaultId, data);
        if (!response.questions || response.questions.length === 0) {
          toast.error("AI failed to generate questions. Try refining your topics.");
          return;
        }
        setGeneratedLanguage(response.language);
        setQuestions(response.questions);
        setActiveSetId(response.id);
        setProgress(loadProgress(response.id));
        setSetWarnings(response.warnings ?? []);
        setStage("questions");
        setActiveQuestionIndex(null);

        const verified = response.verified_count ?? 0;
        toast.success(
          verified > 0
            ? `Generated ${response.questions.length} problems — ${verified} with verified test cases.`
            : `Generated ${response.questions.length} coding questions.`,
        );
        // Refresh saved sets list (the new set was auto-saved)
        fetchSavedSets();
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : "Failed to generate coding questions.",
        );
      }
    });
  }

  // Load a saved set
  async function handleLoadSet(setId: string) {
    setLoadingSetId(setId);
    try {
      const detail = await getCodingSet(vaultId, setId);
      setGeneratedLanguage(detail.language);
      setQuestions(detail.questions);
      setActiveSetId(detail.id);
      setProgress(loadProgress(detail.id));
      setSetWarnings([]);
      setStage("questions");
      setActiveQuestionIndex(null);
      toast.success(`Loaded "${detail.title}" — ${detail.question_count} problems`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load problem set.");
    } finally {
      setLoadingSetId(null);
    }
  }

  // Delete a saved set
  async function handleDeleteSet(setId: string) {
    try {
      await deleteCodingSet(vaultId, setId);
      setSavedSets((prev) => prev.filter((s) => s.id !== setId));
      toast.success("Problem set deleted.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete problem set.");
    }
  }

  function handleReset() {
    setQuestions([]);
    setActiveQuestionIndex(null);
    setActiveSetId(null);
    setProgress({});
    setSetWarnings([]);
    setStage("wizard");
  }

  if (loadingVault) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-12 text-center">
        <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent animate-spin rounded-full mx-auto" />
        <p className="text-zinc-500 text-sm">Loading vault...</p>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 py-16">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-lg font-semibold text-white">Vault Not Found</h2>
        <p className="text-zinc-500 text-sm">We couldn&apos;t load the specified vault details.</p>
        <Link href={`/dashboard/squads/${squadId}/vaults`} className="inline-block">
          <span className="text-violet-400 hover:underline">Back to vaults</span>
        </Link>
      </div>
    );
  }

  const hasResources = resources.some((r) => r.is_ai_ready);

  return (
    <div className="space-y-8">
      {/* Show header only if we are in list view, hide in full editor mode for maximum workspace height */}
      {activeQuestionIndex === null && (
        <VaultHeader vault={vault} squadId={squadId} />
      )}

      <div className={`${activeQuestionIndex !== null ? "w-full" : "max-w-4xl mx-auto"} space-y-6`}>
        {stage === "wizard" && (
          <>
            <CodingWizard
              onSubmit={handleGenerate}
              isPending={isPending}
              hasResources={hasResources}
              resources={resources}
              runtimes={runtimes}
              defaultLanguage={vault?.subject?.name}
            />

            {/* ── Saved Problem Sets ────────────────────────────────────── */}
            {!loadingSets && savedSets.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Saved Problem Sets</h3>
                  <span className="text-[10px] text-zinc-600 font-mono ml-auto">
                    {savedSets.length} set{savedSets.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-white/[0.01] divide-y divide-white/[0.04]">
                  {savedSets.map((set) => (
                    <div
                      key={set.id}
                      className="flex items-center justify-between p-4 hover:bg-white/[0.015] transition-colors"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <button
                          onClick={() => handleLoadSet(set.id)}
                          disabled={loadingSetId === set.id}
                          className="text-sm font-semibold text-white hover:text-emerald-400 transition-colors text-left truncate block"
                        >
                          {set.title}
                        </button>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                          <span className="text-emerald-400/80 font-semibold uppercase tracking-wider">
                            {set.language}
                          </span>
                          <span>·</span>
                          <span className={`font-bold uppercase tracking-wider ${DIFF_COLORS[set.difficulty] ?? "text-zinc-400"}`}>
                            {set.difficulty}
                          </span>
                          <span>·</span>
                          <span>{set.question_count} problems</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(set.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <button
                          onClick={() => handleLoadSet(set.id)}
                          disabled={loadingSetId === set.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:text-white border border-emerald-500/10 hover:border-emerald-500/30 hover:bg-emerald-600/10 rounded-lg transition-all"
                        >
                          {loadingSetId === set.id ? (
                            <div className="w-3 h-3 border border-emerald-400 border-t-transparent animate-spin rounded-full" />
                          ) : (
                            <>
                              <span>Open</span>
                              <ChevronRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteSet(set.id)}
                          className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete problem set"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadingSets && (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border border-emerald-500 border-t-transparent animate-spin rounded-full" />
                <span className="text-xs text-zinc-500 ml-2">Loading saved problem sets...</span>
              </div>
            )}
          </>
        )}

        {stage === "questions" && questions.length > 0 && (
          <>
            {activeQuestionIndex === null ? (
              // ── PROBLEM SET LIST (LeetCode Style Table) ──
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Coding Problems</h2>
                      <p className="text-xs text-zinc-500 capitalize">
                        {questions.length} problems in {generatedLanguage}
                        <span className="text-zinc-600 normal-case">
                          {" "}· {solvedCount} solved
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 border border-white/[0.06] hover:border-white/[0.12] rounded-lg bg-white/[0.01] transition-all"
                  >
                    <RotateCcw className="w-3 h-3" />
                    New Session
                  </button>
                </div>

                {/* Set-level progress */}
                <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${questions.length ? (solvedCount / questions.length) * 100 : 0}%` }}
                  />
                </div>

                {/* Anything the verifier could not guarantee */}
                {setWarnings.length > 0 && (
                  <div className="space-y-1.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-3.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-semibold text-amber-300">
                        Notes from test verification
                      </span>
                    </div>
                    <ul className="space-y-1 pl-5.5">
                      {setWarnings.map((warning, i) => (
                        <li key={i} className="text-[11px] text-amber-200/70 leading-relaxed">
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Problems Table/Cards List */}
                <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-white/[0.01] divide-y divide-white/[0.06]">
                  {questions.map((q, idx) => {
                    const typeConf = TYPE_CONFIG[q.type] ?? TYPE_CONFIG.solve;
                    const diffConf = DIFF_CONFIG[q.difficulty] ?? DIFF_CONFIG.medium;
                    const status = progress[q.number];
                    const solved = status === "Accepted";
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 sm:p-5 hover:bg-white/[0.01] transition-all"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Status */}
                          <span className="shrink-0 w-6 flex items-center justify-center" title={status ?? "Not attempted"}>
                            {solved ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : status ? (
                              <CircleDashed className="w-4 h-4 text-amber-500/70" />
                            ) : (
                              <span className="text-xs font-mono text-zinc-600 font-bold">{idx + 1}</span>
                            )}
                          </span>

                          <div className="space-y-1.5 min-w-0">
                            {/* Title */}
                            <button
                              onClick={() => setActiveQuestionIndex(idx)}
                              className={`text-sm sm:text-base font-semibold hover:text-emerald-400 transition-colors text-left truncate block ${solved ? "text-emerald-300/90" : "text-white"}`}
                            >
                              {q.title}
                            </button>

                            {/* Badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold tracking-wider uppercase shrink-0 ${typeConf.bg} ${typeConf.text}`}>
                                {typeConf.label}
                              </span>
                              <span className={`text-[10px] font-semibold shrink-0 uppercase tracking-wider ${diffConf.text}`}>
                                {diffConf.label}
                              </span>
                              {q.tests_verified && (
                                <span className="text-[10px] text-emerald-500/70 font-semibold uppercase tracking-wider shrink-0">
                                  · {(q.test_cases?.length ?? 0) + (q.hidden_test_count ?? 0)} tests
                                </span>
                              )}
                              {q.topic_hint && (
                                <span className="text-[10px] text-zinc-500 font-medium truncate">
                                  · {q.topic_hint}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Attempt Button */}
                        <button
                          onClick={() => setActiveQuestionIndex(idx)}
                          className="flex items-center gap-1 px-4 py-2 text-xs font-semibold text-emerald-400 hover:text-white border border-emerald-500/10 hover:border-emerald-500/30 hover:bg-emerald-600/10 rounded-xl transition-all shrink-0 ml-4"
                        >
                          <span>{solved ? "Review" : status ? "Retry" : "Solve"}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom actions */}
                <div className="flex items-center justify-center gap-4 pt-4">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-emerald-400 hover:text-white bg-emerald-700/10 hover:bg-emerald-700/20 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate New Problems Set
                  </button>
                </div>
              </div>
            ) : (
              // ── LEETCODE WORKSPACE MODE ──
              <CodingWorkspace
                // Remount per problem so drafts, timer and results reset cleanly.
                key={`${activeSetId ?? "unsaved"}-${questions[activeQuestionIndex].number}`}
                question={questions[activeQuestionIndex]}
                vaultId={vaultId}
                setId={activeSetId}
                topic={vault?.subject?.name ?? vault?.title}
                index={activeQuestionIndex}
                total={questions.length}
                onBack={() => setActiveQuestionIndex(null)}
                onNavigate={(next) =>
                  setActiveQuestionIndex(Math.max(0, Math.min(next, questions.length - 1)))
                }
                onResult={recordResult}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
