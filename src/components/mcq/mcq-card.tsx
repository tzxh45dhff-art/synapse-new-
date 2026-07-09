"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Info, ChevronDown, ChevronUp } from "lucide-react";
import type { MCQQuestion } from "@/types/mcq";

interface Props {
  question: MCQQuestion;
  onAnswer: (correct: boolean) => void;
  disabled: boolean;
}

export function MCQCard({ question, onAnswer, disabled }: Props) {
  const [selectedKey, setSelectedKey] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const hasAnswered = selectedKey !== null;

  function handleSelect(key: "A" | "B" | "C" | "D") {
    if (hasAnswered || disabled) return;
    setSelectedKey(key);
    const isCorrect = key === question.correct_answer;
    onAnswer(isCorrect);
    setShowExplanation(true);
  }

  const badgeColors = {
    easy: "border-green-500/20 text-green-400 bg-green-500/5",
    medium: "border-blue-500/20 text-blue-400 bg-blue-500/5",
    hard: "border-red-500/20 text-red-400 bg-red-500/5",
  }[question.difficulty] || "border-zinc-500/20 text-zinc-400 bg-zinc-500/5";

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 sm:p-6 space-y-4 transition-all hover:border-white/[0.1]">
      {/* Header info */}
      <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
        <span className="text-zinc-500 font-semibold font-mono">QUESTION {question.number}</span>
        <div className="flex items-center gap-2">
          {question.topic_hint && (
            <span className="border border-white/[0.06] px-2 py-0.5 rounded-md text-zinc-400 bg-white/[0.01]">
              {question.topic_hint}
            </span>
          )}
          <span className={`border px-2 py-0.5 rounded-md capitalize font-medium ${badgeColors}`}>
            {question.difficulty}
          </span>
        </div>
      </div>

      {/* Question Text */}
      <h3 className="text-base font-medium text-white leading-relaxed">
        {question.question}
      </h3>

      {/* Options list */}
      <div className="grid gap-3 pt-1">
        {question.options.map((opt) => {
          const isSelected = selectedKey === opt.key;
          const isCorrectAnswer = opt.key === question.correct_answer;
          
          let optionStyles = "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-zinc-300";
          if (hasAnswered) {
            if (isCorrectAnswer) {
              // Highlight the correct answer in green
              optionStyles = "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/10";
            } else if (isSelected) {
              // Selected incorrect answer in red
              optionStyles = "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/10";
            } else {
              // Other unselected options fade
              optionStyles = "border-white/[0.03] bg-white/[0.005] text-zinc-600 opacity-60";
            }
          }

          return (
            <button
              key={opt.key}
              type="button"
              disabled={hasAnswered || disabled}
              onClick={() => handleSelect(opt.key)}
              className={`flex items-start gap-3 w-full text-left p-3.5 rounded-xl border text-sm transition-all duration-200
                ${optionStyles} ${!hasAnswered && !disabled ? "hover:translate-x-1 cursor-pointer" : ""}`}
            >
              {/* Option Key Circle */}
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 font-mono border
                ${hasAnswered && isCorrectAnswer
                  ? "bg-green-500/20 border-green-500/30 text-green-400"
                  : hasAnswered && isSelected
                    ? "bg-red-500/20 border-red-500/30 text-red-400"
                    : "bg-white/[0.04] border-white/[0.08] text-zinc-400"
                }`}
              >
                {opt.key}
              </div>

              {/* Option Text */}
              <span className="flex-1 pt-0.5 leading-relaxed">{opt.text}</span>

              {/* Status Icons */}
              {hasAnswered && isCorrectAnswer && (
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              )}
              {hasAnswered && isSelected && !isCorrectAnswer && (
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation toggler */}
      {hasAnswered && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{showExplanation ? "Hide Explanation" : "Show Explanation"}</span>
            {showExplanation ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showExplanation && (
            <div className="mt-3 p-4 rounded-xl border border-violet-500/10 bg-violet-600/[0.02] text-zinc-400 text-xs sm:text-sm leading-relaxed space-y-2">
              <p className="font-semibold text-violet-300">Explanation:</p>
              <p>{question.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
