"use client";

import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import {
  Code2, Bug, Eye, PenLine, Terminal, Play, CheckCircle,
  Lightbulb, RefreshCw, HelpCircle, ChevronRight, Check,
  AlertTriangle, XCircle, ArrowLeft, Loader2, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CodingQuestion, CodingGradeResponse } from "@/types/coding";
import { gradeCodingQuestion } from "@/app/actions/coding/generate";
import { toast } from "sonner";

interface Props {
  question: CodingQuestion;
  vaultId: string;
  onBack: () => void;
}

type Tab = "description" | "hints" | "solution";

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
  cpp: "cpp",
  javascript: "javascript",
  typescript: "typescript",
  go: "go",
};

const handleEditorWillMount = (monaco: any) => {
  monaco.editor.defineTheme("custom-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#09090b",
    },
  });
};

export function CodingWorkspace({ question, vaultId, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("description");
  const [code, setCode] = useState(question.code_snippet ?? "");
  const [hintsRevealed, setHintsRevealed] = useState(0);

  // Grader / Test execution state
  const [isGrading, setIsGrading] = useState(false);
  const [result, setResult] = useState<CodingGradeResponse | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);

  // Reset code when question changes
  useEffect(() => {
    setCode(question.code_snippet ?? "");
    setResult(null);
    setConsoleOpen(false);
    setHintsRevealed(0);
    setActiveTab("description");
  }, [question]);

  async function handleGrade(isSubmit: boolean) {
    setIsGrading(true);
    setConsoleOpen(true);
    try {
      const response = await gradeCodingQuestion(vaultId, {
        title: question.title,
        type: question.type,
        problem: question.problem,
        language: question.language,
        code: code,
        solution: question.solution,
        examples: question.examples,
        constraints: question.constraints,
      });
      setResult(response);
      if (response.status === "Accepted") {
        toast.success(isSubmit ? "Problem Solved Successfully!" : "All Test Cases Passed!");
      } else {
        toast.error(`${response.status}: Passed ${response.test_cases_passed}/${response.total_test_cases}`);
      }
    } catch (err: any) {
      toast.error("Failed to run code grader.");
    } finally {
      setIsGrading(false);
    }
  }

  const typeConf = TYPE_LABELS[question.type] ?? TYPE_LABELS.solve;
  const langKey = MONACO_LANGS[question.language.toLowerCase()] ?? "python";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-100px)] min-h-[620px]">
      {/* ── LEFT PANEL: Problem description, examples, hints ── */}
      <div className="lg:col-span-5 bg-zinc-950/80 border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden">
        {/* Navigation / Header tabs */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2 shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors mr-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-zinc-400 font-mono">Q{question.number}</span>
          </div>

          <div className="flex gap-1">
            {(["description", "hints", "solution"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all
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
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">{question.title}</h2>
              </div>

              {/* Problem statement */}
              <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap pt-1 font-sans">
                {question.problem}
              </div>

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
                          <span className="text-zinc-300">{ex.input}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-zinc-500 shrink-0">Output:</span>
                          <span className="text-emerald-400">{ex.output}</span>
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

                {hintsRevealed < question.hints.length ? (
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
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2 shrink-0 bg-white/[0.02]">
          <span className="text-xs font-semibold text-zinc-400 font-mono flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-zinc-500" />
            Code Editor
          </span>
          <span className="text-xs text-zinc-500 font-mono capitalize">
            {question.language} template
          </span>
        </div>

        {/* Monaco Editor Container */}
        <div className="flex-1 relative min-h-[250px]">
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
            }}
          />
        </div>

        {/* ── Grader Console Drawer (Collapsible) ── */}
        {consoleOpen && (
          <div className="absolute bottom-16 left-0 right-0 bg-zinc-950 border-t border-white/[0.08] shadow-2xl flex flex-col max-h-[50%] overflow-hidden z-20 transition-all duration-300">
            {/* Console header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.01] shrink-0">
              <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Grader Console
              </span>
              <button
                onClick={() => setConsoleOpen(false)}
                className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-300"
              >
                Close Console
              </button>
            </div>

            {/* Console Logs */}
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-3.5 bg-black/40">
              {isGrading ? (
                <div className="flex items-center gap-2 text-zinc-400 py-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                  <span>Simulating code execution against test cases...</span>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  {/* Status Box */}
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      {result.status === "Accepted" ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                      <div>
                        <p className={`font-bold text-sm ${result.status === "Accepted" ? "text-green-400" : "text-red-400"}`}>
                          {result.status}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          Passed {result.test_cases_passed} / {result.total_test_cases} test cases
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Feedback */}
                  {result.feedback && (
                    <div className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.01] text-zinc-400 leading-relaxed">
                      <span className="font-semibold text-zinc-200 block mb-1">Feedback:</span>
                      {result.feedback}
                    </div>
                  )}

                  {/* Compiler / Output Trace */}
                  {result.compiler_output && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Compiler Output / Log Trace:</span>
                      <pre className="p-3 bg-red-950/20 border border-red-500/10 rounded-xl text-red-300 whitespace-pre-wrap overflow-x-auto text-[11px] leading-relaxed">
                        {result.compiler_output}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-zinc-600 text-center py-6">
                  No execution logs. Click Run or Submit.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer actions bar */}
        <div className="border-t border-white/[0.06] px-4 py-3 shrink-0 flex items-center justify-between bg-white/[0.01] z-10">
          <Button
            variant="ghost"
            onClick={() => setConsoleOpen(!consoleOpen)}
            className="text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] px-3.5 py-2 font-medium"
          >
            Console
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={isGrading}
              onClick={() => handleGrade(false)}
              className="border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06] hover:text-white px-4 py-2 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all"
            >
              <Play className="w-3.5 h-3.5 text-zinc-400 fill-zinc-400" />
              Run Code
            </Button>
            <Button
              disabled={isGrading}
              onClick={() => handleGrade(true)}
              className="bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-2.5 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-700/10"
            >
              <Check className="w-3.5 h-3.5" />
              Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
