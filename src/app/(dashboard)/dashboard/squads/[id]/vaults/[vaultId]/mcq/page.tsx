"use client";

import { use, useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, BrainCircuit, Sparkles, AlertCircle, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { VaultHeader } from "@/components/vaults/vault-header";
import { MCQWizard } from "@/components/mcq/mcq-wizard";
import { MCQCard } from "@/components/mcq/mcq-card";
import { MCQResults } from "@/components/mcq/mcq-results";
import { getVault } from "@/app/actions/vaults/queries";
import { listResources } from "@/app/actions/resources/queries";
import { generateMCQ } from "@/app/actions/mcq/generate";
import { recordPracticeAttempt } from "@/app/actions/intelligence/mutations";
import type { VaultDetail, ResourceListItem } from "@/types/vault";
import type { MCQQuestion, MCQGenerateRequest } from "@/types/mcq";

interface Props {
  params: Promise<{ id: string; vaultId: string }>;
}

type Stage = "wizard" | "quiz" | "results";

export default function MCQPage({ params }: Props) {
  const { id: squadId, vaultId } = use(params);

  // Vault data
  const [vault, setVault] = useState<VaultDetail | null>(null);
  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [loadingVault, setLoadingVault] = useState(true);

  // MCQ state
  const [stage, setStage] = useState<Stage>("wizard");
  const [isPending, startTransition] = useTransition();
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [score, setScore] = useState(0);
  const [answersCount, setAnswersCount] = useState(0);
  const scoreRef = useRef(0);

  // Wizard input history (for retry)
  const [lastRequest, setLastRequest] = useState<MCQGenerateRequest | null>(null);

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

  // Generate MCQs
  function handleGenerate(data: MCQGenerateRequest) {
    setLastRequest(data);
    startTransition(async () => {
      try {
        const response = await generateMCQ(vaultId, data);
        if (!response.questions || response.questions.length === 0) {
          toast.error("AI failed to generate questions. Please refine your syllabus topics.");
          return;
        }
        setQuestions(response.questions);
        setScore(0);
        setAnswersCount(0);
        scoreRef.current = 0;
        setStage("quiz");
        toast.success(`Successfully generated ${response.questions.length} questions!`);
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to generate MCQs.");
      }
    });
  }

  // Answer callback
  function handleAnswer(correct: boolean) {
    if (correct) {
      scoreRef.current += 1;
      setScore((s) => s + 1);
    }
    setAnswersCount((c) => {
      const nextCount = c + 1;
      if (nextCount === questions.length) {
        // finished
        const total = questions.length;
        const finalScore = scoreRef.current;
        setTimeout(() => setStage("results"), 1200);
        if (total > 0) {
          recordPracticeAttempt({
            vault_id: vaultId,
            session_type: "mcq",
            score_pct: Math.round((finalScore / total) * 100),
            topic: vault?.subject?.name ?? vault?.title,
          }).catch(() => {
            /* best-effort tracking; never block the results screen */
          });
        }
      }
      return nextCount;
    });
  }

  // Retake same quiz
  function handleRetry() {
    // Reset selection states in cards by setting stage back to quiz and key changes
    setScore(0);
    setAnswersCount(0);
    scoreRef.current = 0;
    // shuffle questions if we want, or keep same
    setStage("quiz");
    toast.info("Retaking current quiz...");
  }

  // Back to setup
  function handleBackToWizard() {
    setQuestions([]);
    setScore(0);
    setAnswersCount(0);
    scoreRef.current = 0;
    setStage("wizard");
  }

  if (loadingVault) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-12 text-center">
        <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent animate-spin rounded-full mx-auto" />
        <p className="text-zinc-500 text-sm">Loading practice session...</p>
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

  const hasResources = resources.some(r => r.is_ai_ready);

  return (
    <div className="space-y-10">
      <VaultHeader vault={vault} squadId={squadId} />

      <div className="max-w-4xl mx-auto space-y-8">
        {stage === "wizard" && (
          <MCQWizard
            onSubmit={handleGenerate}
            isPending={isPending}
            hasResources={hasResources}
          />
        )}

        {stage === "quiz" && (
          <div className="space-y-6">
            {/* Header progress strip */}
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 gap-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-violet-400" />
                <span className="text-sm font-semibold text-white">Practice Session</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 font-mono">
                  {answersCount} / {questions.length} Answered
                </span>
                <div className="w-24 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className="h-full bg-violet-600 transition-all duration-300"
                    style={{ width: `${(answersCount / questions.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Questions stack */}
            <div className="space-y-6">
              {questions.map((q) => (
                <MCQCard
                  key={`${q.number}-${stage}`}
                  question={q}
                  onAnswer={handleAnswer}
                  disabled={isPending}
                />
              ))}
            </div>
          </div>
        )}

        {stage === "results" && (
          <div className="space-y-8">
            <MCQResults
              score={score}
              total={questions.length}
              onRetry={handleRetry}
              onBackToWizard={handleBackToWizard}
            />

            {/* Review questions with explanations */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                Review Your Answers
              </h3>
              <div className="space-y-6">
                {questions.map((q) => (
                  <div
                    key={`review-${q.number}`}
                    className="bg-white/[0.01] border border-white/[0.04] rounded-2xl p-5 space-y-3"
                  >
                    <p className="text-xs text-zinc-500 font-mono">QUESTION {q.number}</p>
                    <p className="text-sm font-medium text-white">{q.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      {q.options.map((opt) => (
                        <div
                          key={opt.key}
                          className={`p-2.5 rounded-lg border
                            ${opt.key === q.correct_answer
                              ? "border-green-500/20 bg-green-500/5 text-green-400"
                              : "border-white/[0.04] bg-white/[0.005] text-zinc-500"
                            }`}
                        >
                          <span className="font-semibold mr-1.5">{opt.key}.</span> {opt.text}
                        </div>
                      ))}
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs text-zinc-400 mt-2 leading-relaxed">
                      <span className="font-semibold text-violet-300 block mb-1">Explanation:</span>
                      {q.explanation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
