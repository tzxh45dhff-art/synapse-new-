"use client";

import { useState } from "react";
import {
  Code2, Bug, Eye, PenLine, ChevronDown, ChevronUp,
  Copy, Check, Lightbulb, Eye as EyeIcon, EyeOff,
  CheckCircle2, XCircle, ChevronRight,
} from "lucide-react";
import type { CodingQuestion } from "@/types/coding";

interface Props {
  question: CodingQuestion;
  number: number;
}

// ── Type/difficulty badge configs ─────────────────────────────────────────────

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  solve: {
    label: "Implement",
    icon: <Code2 className="w-3 h-3" />,
    color: "border-emerald-500/20 text-emerald-400 bg-emerald-500/5",
  },
  debug: {
    label: "Debug",
    icon: <Bug className="w-3 h-3" />,
    color: "border-red-500/20 text-red-400 bg-red-500/5",
  },
  trace: {
    label: "Trace Output",
    icon: <Eye className="w-3 h-3" />,
    color: "border-blue-500/20 text-blue-400 bg-blue-500/5",
  },
  fill: {
    label: "Fill Blanks",
    icon: <PenLine className="w-3 h-3" />,
    color: "border-yellow-500/20 text-yellow-400 bg-yellow-500/5",
  },
};

const DIFF_COLORS: Record<string, string> = {
  easy:   "border-green-500/20 text-green-400 bg-green-500/5",
  medium: "border-blue-500/20 text-blue-400 bg-blue-500/5",
  hard:   "border-red-500/20 text-red-400 bg-red-500/5",
};

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md border border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.15] transition-all"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── Code block ─────────────────────────────────────────────────────────────────

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.06]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06]">
        <span className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
          {language}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed text-zinc-200 bg-black/20">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function CodingQuestionCard({ question, number }: Props) {
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  // For trace / fill — user can type + check answer
  const [userAnswer, setUserAnswer] = useState("");
  const [answerChecked, setAnswerChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const typeConf = TYPE_CONFIG[question.type] ?? TYPE_CONFIG.solve;
  const isInteractive = question.type === "trace" || question.type === "fill";

  function checkAnswer() {
    const normalized = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const correct = normalized(question.solution) === normalized(userAnswer);
    setIsCorrect(correct);
    setAnswerChecked(true);
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 sm:p-6 space-y-5 transition-all hover:border-white/[0.1]">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-500 font-semibold font-mono text-xs">
            Q{number}
          </span>
          {/* Type badge */}
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${typeConf.color}`}>
            {typeConf.icon}
            {typeConf.label}
          </span>
          {/* Difficulty badge */}
          <span className={`px-2 py-0.5 rounded-md border text-xs font-medium capitalize ${DIFF_COLORS[question.difficulty] ?? ""}`}>
            {question.difficulty}
          </span>
          {/* Language badge */}
          <span className="px-2 py-0.5 rounded-md border border-white/[0.06] text-zinc-400 bg-white/[0.01] text-xs font-mono">
            {question.language}
          </span>
        </div>
        {question.topic_hint && (
          <span className="text-[10px] text-zinc-500 border border-white/[0.06] px-2 py-0.5 rounded-md bg-white/[0.01]">
            {question.topic_hint}
          </span>
        )}
      </div>

      {/* ── Title + Problem ── */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-white leading-snug">{question.title}</h3>
        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{question.problem}</p>
      </div>

      {/* ── Code snippet ── */}
      {question.code_snippet && (
        <CodeBlock code={question.code_snippet} language={question.language} />
      )}

      {/* ── Examples (collapsible) ── */}
      {question.examples.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowExamples(!showExamples)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-semibold transition-colors"
          >
            {showExamples ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showExamples ? "Hide" : "Show"} Examples ({question.examples.length})
          </button>
          {showExamples && (
            <div className="mt-3 space-y-3">
              {question.examples.map((ex, i) => (
                <div
                  key={i}
                  className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 text-xs font-mono space-y-2"
                >
                  <div className="flex gap-2">
                    <span className="text-zinc-500 shrink-0">Input:</span>
                    <span className="text-zinc-300">{ex.input}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-zinc-500 shrink-0">Output:</span>
                    <span className="text-emerald-400">{ex.output}</span>
                  </div>
                  {ex.explanation && (
                    <p className="text-zinc-500 text-[10px] pt-1 border-t border-white/[0.05]">
                      {ex.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Constraints ── */}
      {question.constraints.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Constraints</p>
          <ul className="space-y-1">
            {question.constraints.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-zinc-400 font-mono">
                <ChevronRight className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── User answer input (trace / fill) ── */}
      {isInteractive && (
        <div className="space-y-3 pt-2 border-t border-white/[0.06]">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            {question.type === "trace" ? "Your Answer (predicted output):" : "Fill in the blanks:"}
          </label>
          <textarea
            value={userAnswer}
            onChange={(e) => { setUserAnswer(e.target.value); setAnswerChecked(false); setIsCorrect(null); }}
            placeholder={
              question.type === "trace"
                ? "Type the exact output the code would print..."
                : "Type the completed code with blanks filled in..."
            }
            rows={question.type === "fill" ? 5 : 2}
            className="w-full bg-black/20 border border-white/[0.08] rounded-xl p-3 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none resize-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={checkAnswer}
              disabled={!userAnswer.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-700/60 hover:bg-emerald-700 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Check Answer
            </button>
            {answerChecked && isCorrect !== null && (
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${isCorrect ? "text-green-400" : "text-red-400"}`}>
                {isCorrect
                  ? <><CheckCircle2 className="w-4 h-4" /> Correct!</>
                  : <><XCircle className="w-4 h-4" /> Not quite — check the solution</>
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hints ── */}
      {question.hints.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Hints ({hintsRevealed}/{question.hints.length})
            </span>
          </div>
          <div className="space-y-2">
            {question.hints.slice(0, hintsRevealed).map((hint, i) => (
              <div
                key={i}
                className="p-3 rounded-xl border border-yellow-500/10 bg-yellow-500/[0.03] text-xs text-zinc-300 leading-relaxed"
              >
                <span className="font-semibold text-yellow-400 mr-1.5">Hint {i + 1}:</span>
                {hint}
              </div>
            ))}
            {hintsRevealed < question.hints.length && (
              <button
                type="button"
                onClick={() => setHintsRevealed((h) => h + 1)}
                className="text-xs text-yellow-500 hover:text-yellow-400 font-semibold flex items-center gap-1 transition-colors"
              >
                <Lightbulb className="w-3 h-3" />
                {hintsRevealed === 0 ? "Show first hint" : `Show hint ${hintsRevealed + 1}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Solution reveal ── */}
      <div className="pt-2 border-t border-white/[0.06] space-y-3">
        <button
          type="button"
          onClick={() => setShowSolution(!showSolution)}
          className={`flex items-center gap-2 text-xs font-semibold transition-colors
            ${showSolution ? "text-zinc-400 hover:text-zinc-200" : "text-emerald-500 hover:text-emerald-400"}`}
        >
          {showSolution ? <EyeOff className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
          {showSolution ? "Hide Solution" : "Reveal Solution"}
        </button>

        {showSolution && (
          <div className="space-y-3">
            <CodeBlock code={question.solution} language={question.language} />
            {question.solution_explanation && (
              <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-600/[0.03] text-xs text-zinc-400 leading-relaxed">
                <span className="font-semibold text-emerald-300 block mb-1">Explanation:</span>
                {question.solution_explanation}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
