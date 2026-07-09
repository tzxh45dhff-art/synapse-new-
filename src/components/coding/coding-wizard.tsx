"use client";

import { useState } from "react";
import {
  Terminal, Code2, Bug, Eye, PenLine, BookOpen,
  FileText, Settings, ArrowRight, Loader2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type {
  CodingLanguage,
  CodingDifficulty,
  CodingQuestionType,
  CodingGenerateRequest,
} from "@/types/coding";

interface Props {
  onSubmit: (data: CodingGenerateRequest) => void;
  isPending: boolean;
  hasResources: boolean;
}

const LANGUAGES: { value: CodingLanguage; label: string; icon: string }[] = [
  { value: "python",     label: "Python",     icon: "🐍" },
  { value: "java",       label: "Java",       icon: "☕" },
  { value: "cpp",        label: "C++",        icon: "⚡" },
  { value: "javascript", label: "JavaScript", icon: "🟨" },
  { value: "typescript", label: "TypeScript", icon: "🔷" },
  { value: "go",         label: "Go",         icon: "🔵" },
];

const DIFFICULTIES: { value: CodingDifficulty; label: string; desc: string; color: string }[] = [
  { value: "easy",  label: "Easy",   desc: "Fundamentals & basics",   color: "border-green-500/20 hover:border-green-500/40 text-green-400 bg-green-500/5" },
  { value: "medium",label: "Medium", desc: "Standard algorithms",     color: "border-blue-500/20 hover:border-blue-500/40 text-blue-400 bg-blue-500/5" },
  { value: "hard",  label: "Hard",   desc: "Optimisation & edge cases",color: "border-red-500/20 hover:border-red-500/40 text-red-400 bg-red-500/5" },
  { value: "mixed", label: "Mixed",  desc: "Balanced challenge",      color: "border-purple-500/20 hover:border-purple-500/40 text-purple-400 bg-purple-500/5" },
];

const QUESTION_TYPES: {
  value: CodingQuestionType;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "solve",
    label: "Implement",
    desc: "Write the function from scratch",
    icon: <Code2 className="w-4 h-4" />,
  },
  {
    value: "debug",
    label: "Debug",
    desc: "Find & fix bugs in broken code",
    icon: <Bug className="w-4 h-4" />,
  },
  {
    value: "trace",
    label: "Trace Output",
    desc: "Predict what the code prints",
    icon: <Eye className="w-4 h-4" />,
  },
  {
    value: "fill",
    label: "Fill in Blanks",
    desc: "Complete the missing code",
    icon: <PenLine className="w-4 h-4" />,
  },
];

const COUNT_OPTIONS = [1, 2, 3, 5, 7, 10];

export function CodingWizard({ onSubmit, isPending, hasResources }: Props) {
  const [language, setLanguage] = useState<CodingLanguage>("python");
  const [difficulty, setDifficulty] = useState<CodingDifficulty>("medium");
  const [selectedTypes, setSelectedTypes] = useState<CodingQuestionType[]>(["solve", "debug"]);
  const [count, setCount] = useState(5);
  const [topics, setTopics] = useState("");
  const [useVaultContext, setUseVaultContext] = useState(hasResources);
  const [customInstruction, setCustomInstruction] = useState("");

  function toggleType(type: CodingQuestionType) {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.length > 1 ? prev.filter((t) => t !== type) : prev // keep at least one
        : [...prev, type]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topics.trim()) return;
    onSubmit({
      language,
      difficulty,
      question_types: selectedTypes,
      count,
      topics: topics.trim(),
      use_vault_context: useVaultContext,
      custom_instruction: customInstruction.trim() || undefined,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8 max-w-2xl mx-auto bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 sm:p-8 backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center text-emerald-400 shrink-0">
          <Terminal className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Configure Coding Questions</h2>
          <p className="text-xs text-zinc-500">Customize the AI generator to build your coding practice set.</p>
        </div>
      </div>

      {/* Topics */}
      <div className="space-y-2">
        <Label htmlFor="topics" className="text-sm text-zinc-300 font-medium">
          Topics / Syllabus to Cover *
        </Label>
        <Textarea
          id="topics"
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          placeholder="e.g. Binary Trees, BFS/DFS, Dynamic Programming (memoization), Sliding Window"
          rows={3}
          required
          className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-emerald-500/50 resize-none text-sm leading-relaxed"
        />
        <p className="text-xs text-zinc-500">
          Specify the data structures, algorithms, or programming concepts to generate questions for.
        </p>
      </div>

      {/* Language */}
      <div className="space-y-3">
        <Label className="text-sm text-zinc-300 font-medium">Programming Language</Label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              type="button"
              onClick={() => setLanguage(lang.value)}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all duration-200 gap-1
                ${language === lang.value
                  ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10 text-white"
                  : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-300"
                }`}
            >
              <span className="text-lg">{lang.icon}</span>
              <span className="text-[10px] font-medium">{lang.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Question Types */}
      <div className="space-y-3">
        <Label className="text-sm text-zinc-300 font-medium">
          Question Types <span className="text-zinc-500 font-normal">(select multiple)</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {QUESTION_TYPES.map((qt) => {
            const isSelected = selectedTypes.includes(qt.value);
            return (
              <button
                key={qt.value}
                type="button"
                onClick={() => toggleType(qt.value)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200
                  ${isSelected
                    ? "border-emerald-500/40 bg-emerald-500/10 text-white ring-1 ring-emerald-500/20"
                    : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-300"
                  }`}
              >
                <div className={`shrink-0 ${isSelected ? "text-emerald-400" : "text-zinc-500"}`}>
                  {qt.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold">{qt.label}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{qt.desc}</p>
                </div>
                <div className={`ml-auto w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all
                  ${isSelected ? "border-emerald-500 bg-emerald-600" : "border-white/[0.12] bg-transparent"}`}>
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Difficulty + Count row */}
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Difficulty */}
        <div className="space-y-3">
          <Label className="text-sm text-zinc-300 font-medium">Difficulty</Label>
          <div className="grid grid-cols-2 gap-2">
            {DIFFICULTIES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDifficulty(opt.value)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all duration-200
                  ${difficulty === opt.value
                    ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10 text-white"
                    : opt.color
                  }`}
              >
                <span className="text-xs font-semibold">{opt.label}</span>
                <span className="text-[10px] text-zinc-500 mt-0.5">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className="space-y-3">
          <Label className="text-sm text-zinc-300 font-medium">Number of Questions</Label>
          <div className="flex flex-wrap gap-2">
            {COUNT_OPTIONS.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setCount(num)}
                className={`px-3.5 py-2 text-sm font-semibold rounded-xl border transition-all duration-200
                  ${count === num
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30"
                    : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-300"
                  }`}
              >
                {num} {num === 1 ? "Q" : "Qs"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Context options */}
      <div className="space-y-4 pt-2 border-t border-white/[0.06]">
        {hasResources ? (
          <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-white/[0.06] bg-white/[0.01]">
            <div className="flex gap-2.5">
              <FileText className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <Label htmlFor="vault-ctx" className="text-sm text-zinc-300 font-medium cursor-pointer">
                  Use Vault Resources Context
                </Label>
                <p className="text-xs text-zinc-500 mt-0.5">
                  AI reads your uploaded files to ground questions in your actual study material.
                </p>
              </div>
            </div>
            <button
              type="button"
              id="vault-ctx"
              onClick={() => setUseVaultContext(!useVaultContext)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0
                ${useVaultContext ? "bg-emerald-600" : "bg-zinc-800"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform
                ${useVaultContext ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01]">
            <BookOpen className="w-4 h-4 text-zinc-600" />
            <p className="text-xs text-zinc-500">
              No files uploaded to this vault yet. AI will generate general questions on the specified topic.
            </p>
          </div>
        )}

        {/* Custom instruction */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-zinc-500" />
            <Label htmlFor="custom-instruction" className="text-xs text-zinc-400 font-medium">
              Additional Prompt Instructions (Optional)
            </Label>
          </div>
          <Input
            id="custom-instruction"
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            placeholder="e.g. Focus on recursion. Avoid questions about sorting algorithms."
            className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-emerald-500/50 text-xs py-2"
          />
        </div>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={isPending || !topics.trim()}
        className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-6 rounded-xl gap-2 transition-all hover:shadow-lg hover:shadow-emerald-700/10"
      >
        {isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating questions (this may take a moment)...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate Coding Questions
            <ArrowRight className="w-4 h-4 ml-1" />
          </>
        )}
      </Button>
    </form>
  );
}
