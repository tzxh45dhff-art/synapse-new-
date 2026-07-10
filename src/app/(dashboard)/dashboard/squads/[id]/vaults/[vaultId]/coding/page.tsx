"use client";

import { use, useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Terminal, AlertCircle, RotateCcw, CheckCircle2, Sparkles, ChevronRight, Play } from "lucide-react";
import { toast } from "sonner";
import { VaultHeader } from "@/components/vaults/vault-header";
import { CodingWizard } from "@/components/coding/coding-wizard";
import { CodingWorkspace } from "@/components/coding/coding-workspace";
import { getVault } from "@/app/actions/vaults/queries";
import { listResources } from "@/app/actions/resources/queries";
import { generateCodingQuestions } from "@/app/actions/coding/generate";
import type { VaultDetail, ResourceListItem } from "@/types/vault";
import type { CodingQuestion, CodingGenerateRequest } from "@/types/coding";

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

export default function CodingQuestionsPage({ params }: Props) {
  const { id: squadId, vaultId } = use(params);

  // Vault data
  const [vault, setVault] = useState<VaultDetail | null>(null);
  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [loadingVault, setLoadingVault] = useState(true);

  // Question state
  const [stage, setStage] = useState<Stage>("wizard");
  const [isPending, startTransition] = useTransition();
  const [questions, setQuestions] = useState<CodingQuestion[]>([]);
  const [generatedLanguage, setGeneratedLanguage] = useState("");
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);

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

  useEffect(() => {
    fetchVaultData();
  }, [fetchVaultData]);

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
        setStage("questions");
        setActiveQuestionIndex(null); // return to problem set list initially
        toast.success(`Generated ${response.questions.length} coding questions!`);
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to generate coding questions.");
      }
    });
  }

  function handleReset() {
    setQuestions([]);
    setActiveQuestionIndex(null);
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
          <CodingWizard
            onSubmit={handleGenerate}
            isPending={isPending}
            hasResources={hasResources}
            resources={resources}
          />
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
                        {questions.length} problems generated in {generatedLanguage}
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

                {/* Problems Table/Cards List */}
                <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-white/[0.01] divide-y divide-white/[0.06]">
                  {questions.map((q, idx) => {
                    const typeConf = TYPE_CONFIG[q.type] ?? TYPE_CONFIG.solve;
                    const diffConf = DIFF_CONFIG[q.difficulty] ?? DIFF_CONFIG.medium;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 sm:p-5 hover:bg-white/[0.01] transition-all"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Number */}
                          <span className="text-xs font-mono text-zinc-600 font-bold shrink-0 w-6">
                            {idx + 1}
                          </span>

                          <div className="space-y-1.5 min-w-0">
                            {/* Title */}
                            <button
                              onClick={() => setActiveQuestionIndex(idx)}
                              className="text-sm sm:text-base font-semibold text-white hover:text-emerald-400 transition-colors text-left truncate block"
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
                          <span>Solve</span>
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
                question={questions[activeQuestionIndex]}
                vaultId={vaultId}
                topic={vault?.subject?.name ?? vault?.title}
                onBack={() => setActiveQuestionIndex(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
