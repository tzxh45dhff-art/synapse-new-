"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Editor from "@monaco-editor/react";
import {
  Code2, Bug, Eye, PenLine, Terminal, Play, CheckCircle,
  Lightbulb, RefreshCw, ChevronRight, Check, ChevronLeft,
  XCircle, ArrowLeft, Loader2, Sparkles, RotateCcw, Copy, Clock,
  ShieldCheck, FlaskConical, Lock, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CodingQuestion, CodingGradeResponse, GradeStatus } from "@/types/coding";
import { gradeCodingQuestion } from "@/app/actions/coding/generate";
import { recordPracticeAttempt } from "@/app/actions/intelligence/mutations";
import { TestResults } from "@/components/coding/test-results";
import { toast } from "sonner";

interface Props {
  question: CodingQuestion;
  vaultId: string;
  setId?: string | null;
  topic?: string;
  index: number;
  total: number;
  onBack: () => void;
  onNavigate: (index: number) => void;
  onResult?: (questionNumber: number, status: GradeStatus) => void;
}

type Tab = "description" | "tests" | "hints" | "solution";

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  solve: { label: "Implement", icon: <Code2 className="w-3.5 h-3.5" />, color: "border-emerald-500/20 text-emerald-400 bg-emerald-500/5" },
  debug: { label: "Debug",     icon: <Bug className="w-3.5 h-3.5" />,   color: "border-red-500/20 text-red-400 bg-red-500/5" },
  trace: { label: "Trace",     icon: <Eye className="w-3.5 h-3.5" />,   color: "border-blue-500/20 text-blue-400 bg-blue-500/5" },
  fill:  { label: "Fill Blank",icon: <PenLine className="w-3.5 h-3.5" />,color: "border-yellow-500/20 text-yellow-400 bg-yellow-500/5" },
};

const DIFF_COLORS: Record<string, string> = {
  easy:   "border-green-500/20 text-green-400 bg-green-500/5",
  medium: "border-blue-500/20 text-blue-400 bg-blue-500/5",
  hard:   "border-red-500/20 text-red-400 bg-red-500/5",
};

// Map languages to Monaco languages
const MONACO_LANGS: Record<string, string> = {
  python: "python",
  java: "java",
  c: "c",
  cpp: "cpp",
  javascript: "javascript",
  typescript: "typescript",
  go: "go",
};

type MonacoInstance = Parameters<NonNullable<React.ComponentProps<typeof Editor>["beforeMount"]>>[0];

const handleEditorWillMount = (monaco: MonacoInstance) => {
  monaco.editor.defineTheme("custom-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#09090b",
    },
  });
};

const draftKey = (setId: string | null | undefined, questionNumber: number) =>
  `bunker.coding.draft.${setId ?? "unsaved"}.${questionNumber}`;

/** Restore the saved draft for a problem, falling back to its starter code. */
function initialCode(
  setId: string | null | undefined,
  questionNumber: number,
  fallback: string,
): string {
  try {
    const saved = window.localStorage.getItem(draftKey(setId, questionNumber));
    return saved ?? fallback;
  } catch {
    // Private mode / storage disabled — drafts are a convenience, not a contract.
    return fallback;
  }
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The parent remounts this with a `key` per problem, so all per-problem state
 * is initialised once here rather than resynced by an effect.
 */
export function CodingWorkspace({
  question, vaultId, setId, topic, index, total, onBack, onNavigate, onResult,
}: Props) {
  const isTrace = question.type === "trace";
  const starter = question.code_snippet ?? "";

  const [activeTab, setActiveTab] = useState<Tab>("description");
  const [code, setCode] = useState(() =>
    initialCode(setId, question.number, isTrace ? "" : starter),
  );
  const [hintsRevealed, setHintsRevealed] = useState(0);

  // Grader / test execution state
  const [isGrading, setIsGrading] = useState(false);
  const [gradingMode, setGradingMode] = useState<"run" | "submit" | null>(null);
  const [result, setResult] = useState<CodingGradeResponse | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Bumped per grading run so the results panel remounts with a fresh open tab.
  const [runId, setRunId] = useState(0);

  const gradingRef = useRef(false);

  const visibleTests = useMemo(
    () => (question.test_cases ?? []).filter((t) => !t.hidden),
    [question],
  );
  const hiddenCount = question.hidden_test_count ?? 0;

  // Persist the draft so switching problems (or a refresh) never loses work.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey(setId, question.number), code);
      } catch {
        /* storage full or unavailable — drafts are a convenience, not a contract */
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [code, setId, question.number]);

  // Session timer for the current problem.
  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleGrade = useCallback(
    async (isSubmit: boolean) => {
      if (gradingRef.current) return;
      if (!code.trim()) {
        toast.error(isTrace ? "Type the output you expect first." : "Write some code first.");
        return;
      }
      gradingRef.current = true;
      setIsGrading(true);
      setGradingMode(isSubmit ? "submit" : "run");
      setConsoleOpen(true);
      try {
        const response = await gradeCodingQuestion(vaultId, {
          code,
          set_id: setId ?? null,
          question_number: question.number,
          sample_only: !isSubmit,
          // Inline fallback for sets that were never persisted
          title: question.title,
          type: question.type,
          problem: question.problem,
          language: question.language,
          solution: question.solution,
          examples: question.examples,
          constraints: question.constraints,
        });
        setResult(response);
        setRunId((n) => n + 1);

        if (response.status === "Accepted") {
          toast.success(
            isSubmit
              ? `Accepted — ${response.test_cases_passed}/${response.total_test_cases} test cases passed.`
              : `Sample tests passed (${response.test_cases_passed}/${response.total_test_cases}). Submit to run the hidden cases.`,
          );
        } else {
          toast.error(
            `${response.status} — ${response.test_cases_passed}/${response.total_test_cases} passed`,
          );
        }

        if (isSubmit) {
          onResult?.(question.number, response.status);
          if (response.total_test_cases > 0) {
            recordPracticeAttempt({
              vault_id: vaultId,
              session_type: "coding",
              score_pct: Math.round(
                (response.test_cases_passed / response.total_test_cases) * 100,
              ),
              topic,
            }).catch(() => {
              /* best-effort tracking; never block the grader UI */
            });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to run the grader.";
        toast.error(message);
      } finally {
        gradingRef.current = false;
        setIsGrading(false);
        setGradingMode(null);
      }
    },
    [code, isTrace, onResult, question, setId, topic, vaultId],
  );

  // Keyboard shortcuts: ⌘/Ctrl+Enter runs, ⌘/Ctrl+S submits, Esc closes console.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === "Enter") {
        event.preventDefault();
        void handleGrade(false);
      } else if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleGrade(true);
      } else if (event.key === "Escape") {
        setConsoleOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleGrade]);

  function handleReset() {
    setCode(isTrace ? "" : starter);
    setResult(null);
    toast.success(isTrace ? "Answer cleared." : "Code reset to the starter template.");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Clipboard is unavailable in this browser.");
    }
  }

  const typeConf = TYPE_LABELS[question.type] ?? TYPE_LABELS.solve;
  const langKey = MONACO_LANGS[question.language.toLowerCase()] ?? "python";
  const accepted = result?.status === "Accepted";
  const progressPct = result && result.total_test_cases > 0
    ? Math.round((result.test_cases_passed / result.total_test_cases) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-100px)] min-h-[620px]">
      {/* ── LEFT PANEL: Problem description, examples, hints ── */}
      <div className="lg:col-span-5 bg-zinc-950/80 border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden">
        {/* Navigation / Header tabs */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2 shrink-0 bg-white/[0.02] gap-2">
          <div className="flex items-center gap-0.5">
            <button
              onClick={onBack}
              title="Back to problem list"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate(index - 1)}
              disabled={index === 0}
              title="Previous problem"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-zinc-400 font-mono px-1">
              {index + 1}/{total}
            </span>
            <button
              onClick={() => onNavigate(index + 1)}
              disabled={index >= total - 1}
              title="Next problem"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-1">
            {(["description", "tests", "hints", "solution"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all
                  ${activeTab === tab
                    ? "bg-white/[0.06] text-white border border-white/[0.08]"
                    : "text-zinc-500 hover:text-zinc-300"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-5">
          {activeTab === "description" && (
            <>
              {/* Question title and badges */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium ${typeConf.color}`}>
                    {typeConf.icon}
                    {typeConf.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md border text-xs font-medium capitalize ${DIFF_COLORS[question.difficulty] ?? ""}`}>
                    {question.difficulty}
                  </span>
                  <span className="px-2 py-0.5 rounded-md border border-white/[0.06] text-zinc-400 bg-white/[0.01] text-xs font-mono">
                    {question.language}
                  </span>
                  {question.tests_verified && (
                    <span
                      title="The reference solution was executed against every test case before this question was saved."
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-emerald-500/20 text-emerald-400 bg-emerald-500/5 text-xs font-medium"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      Verified tests
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">{question.title}</h2>
              </div>

              {/* Problem statement */}
              <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap pt-1 font-sans">
                {question.problem}
              </div>

              {/* The code under inspection (debug / trace / fill) */}
              {isTrace && question.code_snippet && (
                <div className="space-y-2 pt-1">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Program
                  </h3>
                  <pre className="p-4 rounded-xl border border-white/[0.06] bg-black/30 overflow-x-auto text-xs font-mono leading-relaxed text-zinc-300">
                    <code>{question.code_snippet}</code>
                  </pre>
                </div>
              )}

              {/* Entry point contract */}
              {question.entry_point && (
                <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.01] p-3">
                  <Code2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Your solution must define{" "}
                    <code className="text-emerald-300 font-mono">{question.entry_point}</code>
                    {" "}and <span className="text-zinc-300">return</span> the answer —
                    printing it is not enough.
                  </p>
                </div>
              )}
              {question.io_mode === "stdio" && (
                <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.01] p-3">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Write a complete program: read the input from{" "}
                    <span className="text-zinc-300">standard input</span> and print the
                    answer to <span className="text-zinc-300">standard output</span>.
                  </p>
                </div>
              )}

              {/* Examples */}
              {question.examples.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Examples</h3>
                  <div className="space-y-3">
                    {question.examples.map((ex, i) => (
                      <div
                        key={i}
                        className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-2 font-mono text-xs"
                      >
                        <p className="text-zinc-500 font-semibold uppercase text-[10px]">Example {i + 1}</p>
                        <div className="flex gap-2">
                          <span className="text-zinc-500 shrink-0">Input:</span>
                          <span className="text-zinc-300 break-all">{ex.input}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-zinc-500 shrink-0">Output:</span>
                          <span className="text-emerald-400 break-all">{ex.output}</span>
                        </div>
                        {ex.explanation && (
                          <div className="text-[10px] text-zinc-500 pt-1.5 border-t border-white/[0.05] leading-relaxed">
                            {ex.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Constraints */}
              {question.constraints.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Constraints</h3>
                  <ul className="space-y-1.5">
                    {question.constraints.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-400 font-mono">
                        <ChevronRight className="w-3.5 h-3.5 text-emerald-500/60 mt-0.5 shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {activeTab === "tests" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3 mb-2">
                <FlaskConical className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Test Cases</h3>
              </div>

              {isTrace ? (
                <p className="text-xs text-zinc-500 leading-relaxed">
                  This problem is graded by really running the program and comparing its
                  output with what you predict. Whitespace differences are forgiven;
                  values are not.
                </p>
              ) : visibleTests.length === 0 && hiddenCount === 0 ? (
                <p className="text-xs text-zinc-500 leading-relaxed">
                  This problem has no automated test cases, so your submission is
                  reviewed by AI rather than executed.
                </p>
              ) : (
                <>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    <span className="text-zinc-300 font-medium">Run</span> checks the
                    sample cases below.{" "}
                    <span className="text-zinc-300 font-medium">Submit</span> also runs{" "}
                    {hiddenCount > 0 ? `${hiddenCount} hidden case${hiddenCount === 1 ? "" : "s"}` : "the full suite"}.
                  </p>

                  <div className="space-y-3">
                    {visibleTests.map((test, i) => (
                      <div
                        key={i}
                        className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-2 font-mono text-xs"
                      >
                        <p className="text-zinc-500 font-semibold uppercase text-[10px]">
                          {test.name || `Sample ${i + 1}`}
                        </p>
                        <div className="flex gap-2">
                          <span className="text-zinc-500 shrink-0">Input:</span>
                          <span className="text-zinc-300 break-all">
                            {test.stdin ?? (test.args ?? []).map((a) => JSON.stringify(a)).join(", ")}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-zinc-500 shrink-0">Expected:</span>
                          <span className="text-emerald-400 break-all">
                            {test.expected_stdout ?? JSON.stringify(test.expected)}
                          </span>
                        </div>
                      </div>
                    ))}

                    {hiddenCount > 0 && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] p-4">
                        <Lock className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                        <p className="text-[11px] text-zinc-500 leading-relaxed">
                          <span className="text-zinc-400 font-semibold">
                            {hiddenCount} hidden test case{hiddenCount === 1 ? "" : "s"}
                          </span>{" "}
                          cover the edge cases. They run on Submit — a hardcoded answer
                          will not get past them.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "hints" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3 mb-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <h3 className="text-sm font-semibold text-white">Progressive Hints</h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Stuck? Reveal hints step-by-step before peeking at the final solution.
              </p>

              <div className="space-y-3 pt-2">
                {question.hints.slice(0, hintsRevealed).map((hint, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-yellow-500/10 bg-yellow-500/[0.03] text-xs sm:text-sm text-zinc-300 leading-relaxed"
                  >
                    <span className="font-bold text-yellow-400 mr-2">Hint {i + 1}:</span>
                    {hint}
                  </div>
                ))}

                {question.hints.length === 0 ? (
                  <p className="text-center text-xs text-zinc-600 font-medium">
                    No hints were generated for this problem.
                  </p>
                ) : hintsRevealed < question.hints.length ? (
                  <Button
                    onClick={() => setHintsRevealed((h) => h + 1)}
                    variant="outline"
                    className="w-full border-yellow-500/20 text-yellow-500 bg-yellow-500/5 hover:bg-yellow-500/10 hover:text-yellow-400 text-xs py-5 rounded-xl gap-2 font-semibold"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    {hintsRevealed === 0 ? "Show First Hint" : `Reveal Hint ${hintsRevealed + 1}`}
                  </Button>
                ) : (
                  <p className="text-center text-xs text-zinc-600 font-medium">All hints revealed.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === "solution" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3 mb-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Reference Solution</h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Take a look at the model implementation and explanation of the solution.
              </p>

              <div className="space-y-3 pt-2">
                <div className="rounded-xl overflow-hidden border border-white/[0.06]">
                  <div className="flex items-center justify-between px-3.5 py-2 bg-white/[0.03] border-b border-white/[0.06]">
                    <span className="text-[10px] font-mono font-medium text-zinc-500 uppercase">{question.language}</span>
                    {question.complexity && (
                      <span className="text-[10px] font-mono text-emerald-400/80">{question.complexity}</span>
                    )}
                  </div>
                  <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-zinc-300 bg-black/20">
                    <code>{question.solution}</code>
                  </pre>
                </div>

                {question.solution_explanation && (
                  <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-600/[0.02] text-xs leading-relaxed text-zinc-400">
                    <span className="font-semibold text-emerald-300 block mb-1.5">Approach:</span>
                    {question.solution_explanation}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: Code Editor & Console ── */}
      <div className="lg:col-span-7 bg-zinc-950/80 border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden relative">
        {/* Editor controls bar */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2 shrink-0 bg-white/[0.02] gap-3">
          <span className="text-xs font-semibold text-zinc-400 font-mono flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-zinc-500" />
            {isTrace ? "Predicted Output" : "Code Editor"}
          </span>

          <div className="flex items-center gap-1">
            <span className="flex items-center gap-1 text-[10px] text-zinc-600 font-mono mr-2">
              <Clock className="w-3 h-3" />
              {formatDuration(elapsed)}
            </span>
            <button
              onClick={handleCopy}
              title="Copy to clipboard"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReset}
              title={isTrace ? "Clear answer" : "Reset to starter code"}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Editor / answer box */}
        <div className="flex-1 relative min-h-[250px]">
          {isTrace ? (
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              placeholder={"Type exactly what the program prints, line by line…"}
              className="absolute inset-0 w-full h-full resize-none bg-zinc-950 text-zinc-200 font-mono text-[13px] leading-relaxed p-4 outline-none placeholder:text-zinc-700"
            />
          ) : (
            <Editor
              height="100%"
              language={langKey}
              theme="custom-dark"
              beforeMount={handleEditorWillMount}
              value={code}
              onChange={(val) => setCode(val ?? "")}
              loading={
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  <span className="text-xs text-zinc-500 font-medium">Loading Editor...</span>
                </div>
              }
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "var(--font-mono), monospace",
                cursorBlinking: "smooth",
                tabSize: 4,
                insertSpaces: true,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                lineNumbersMinChars: 3,
                padding: { top: 12, bottom: 12 },
                bracketPairColorization: { enabled: true },
                renderLineHighlight: "line",
                smoothScrolling: true,
              }}
            />
          )}
        </div>

        {/* ── Grader Console Drawer (Collapsible) ── */}
        {consoleOpen && (
          <div className="absolute bottom-16 left-0 right-0 bg-zinc-950 border-t border-white/[0.08] shadow-2xl flex flex-col max-h-[62%] overflow-hidden z-20 transition-all duration-300">
            {/* Console header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.01] shrink-0 gap-3">
              <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Test Results
              </span>
              <div className="flex items-center gap-2">
                {result && (
                  <span
                    title={
                      result.engine === "executed"
                        ? "Your code was really compiled and run against the test cases."
                        : "No runtime for this language on the server — an AI reviewed the code instead."
                    }
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${
                      result.engine === "executed"
                        ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5"
                        : "border-amber-500/20 text-amber-400 bg-amber-500/5"
                    }`}
                  >
                    {result.engine === "executed" ? (
                      <><ShieldCheck className="w-2.5 h-2.5" /> Executed</>
                    ) : (
                      <><AlertTriangle className="w-2.5 h-2.5" /> AI review</>
                    )}
                  </span>
                )}
                <button
                  onClick={() => setConsoleOpen(false)}
                  className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-300"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Console body */}
            <div className="flex-1 p-4 overflow-y-auto text-xs space-y-3.5 bg-black/40">
              {isGrading ? (
                <div className="flex items-center gap-2 text-zinc-400 py-2 font-mono">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                  <span>
                    {gradingMode === "submit"
                      ? "Running the full test suite…"
                      : "Running the sample test cases…"}
                  </span>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  {/* Status box */}
                  <div className="space-y-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {accepted ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <div>
                          <p className={`font-bold text-sm ${accepted ? "text-green-400" : "text-red-400"}`}>
                            {result.status}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {result.test_cases_passed} / {result.total_test_cases} test cases passed
                            {result.hidden_total > 0 &&
                              ` · ${result.hidden_passed}/${result.hidden_total} hidden`}
                            {result.runtime_ms > 0 && ` · ${result.runtime_ms} ms`}
                          </p>
                        </div>
                      </div>
                      {result.sample_only && (
                        <span className="text-[10px] font-semibold text-zinc-500 border border-white/[0.06] rounded-md px-2 py-0.5 shrink-0">
                          Sample only
                        </span>
                      )}
                    </div>

                    <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${accepted ? "bg-green-500" : "bg-red-500/70"}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Anti-cheat / advisory warnings */}
                  {result.warnings.map((warning, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] text-amber-200/80 leading-relaxed"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                      <span>{warning}</span>
                    </div>
                  ))}

                  {/* Per-case breakdown */}
                  <TestResults key={runId} results={result.results} />

                  {/* Feedback */}
                  {result.feedback && (
                    <div className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.01] text-zinc-400 leading-relaxed">
                      <span className="font-semibold text-zinc-200 block mb-1">Feedback</span>
                      {result.feedback}
                    </div>
                  )}

                  {/* Compiler / runtime trace */}
                  {result.compiler_output && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                        Compiler / runtime output
                      </span>
                      <pre className="p-3 bg-red-950/20 border border-red-500/10 rounded-xl text-red-300 whitespace-pre-wrap overflow-x-auto text-[11px] leading-relaxed font-mono">
                        {result.compiler_output}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-zinc-600 text-center py-6 font-mono">
                  No results yet. Press Run to check the sample cases.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer actions bar */}
        <div className="border-t border-white/[0.06] px-4 py-3 shrink-0 flex items-center justify-between bg-white/[0.01] z-10 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              onClick={() => setConsoleOpen(!consoleOpen)}
              className="text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] px-3.5 py-2 font-medium"
            >
              Console
            </Button>
            <span className="hidden md:inline text-[10px] text-zinc-600 font-mono truncate">
              ⌘↵ run · ⌘S submit
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={isGrading}
              onClick={() => handleGrade(false)}
              className="border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06] hover:text-white px-4 py-2 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {isGrading && gradingMode === "run" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 text-zinc-400 fill-zinc-400" />
              )}
              Run
            </Button>
            <Button
              disabled={isGrading}
              onClick={() => handleGrade(true)}
              className="bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-2.5 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-700/10 disabled:opacity-50"
            >
              {isGrading && gradingMode === "submit" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
