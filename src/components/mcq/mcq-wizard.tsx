"use client";

import { useState } from "react";
import { Sparkles, BrainCircuit, FileText, Settings, ArrowRight, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { MCQDifficulty, MCQGenerateRequest } from "@/types/mcq";

interface Props {
  onSubmit: (data: MCQGenerateRequest) => void;
  isPending: boolean;
  hasResources: boolean;
}

export function MCQWizard({ onSubmit, isPending, hasResources }: Props) {
  const [difficulty, setDifficulty] = useState<MCQDifficulty>("medium");
  const [count, setCount] = useState<number>(10);
  const [topics, setTopics] = useState("");
  const [useVaultContext, setUseVaultContext] = useState(hasResources);
  const [customInstruction, setCustomInstruction] = useState("");

  const difficultyOptions: { value: MCQDifficulty; label: string; desc: string; color: string }[] = [
    { value: "easy", label: "Easy", desc: "Recall & basics", color: "border-green-500/20 hover:border-green-500/40 text-green-400 bg-green-500/5" },
    { value: "medium", label: "Medium", desc: "Application & analysis", color: "border-blue-500/20 hover:border-blue-500/40 text-blue-400 bg-blue-500/5" },
    { value: "hard", label: "Hard", desc: "Complex concepts", color: "border-red-500/20 hover:border-red-500/40 text-red-400 bg-red-500/5" },
    { value: "mixed", label: "Mixed", desc: "Balanced quiz", color: "border-purple-500/20 hover:border-purple-500/40 text-purple-400 bg-purple-500/5" },
  ];

  const countOptions = [5, 10, 15, 20, 30];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topics.trim()) return;
    onSubmit({
      difficulty,
      count,
      topics: topics.trim(),
      use_vault_context: useVaultContext,
      custom_instruction: customInstruction.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl mx-auto bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 sm:p-8 backdrop-blur-md">
      <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center text-violet-400 shrink-0">
          <BrainCircuit className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Configure MCQ Practice</h2>
          <p className="text-xs text-zinc-500">Customize the AI generator to build your practice session.</p>
        </div>
      </div>

      {/* Topics / Syllabus */}
      <div className="space-y-2">
        <Label htmlFor="topics" className="text-sm text-zinc-300 font-medium">Syllabus / Topics to Cover *</Label>
        <Textarea
          id="topics"
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          placeholder="e.g. Memory management, paging, page replacement algorithms, Thrashing, and virtual memory."
          rows={4}
          required
          className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-violet-500/50 resize-none text-sm leading-relaxed"
        />
        <p className="text-xs text-zinc-500">Provide the specific concepts or chapter names to generate relevant questions.</p>
      </div>

      {/* Difficulty */}
      <div className="space-y-3">
        <Label className="text-sm text-zinc-300 font-medium font-sans">Difficulty Level</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {difficultyOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDifficulty(opt.value)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200
                ${difficulty === opt.value
                  ? "border-violet-500 ring-2 ring-violet-500/20 bg-violet-500/10 text-white"
                  : opt.color
                }`}
            >
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className="text-[10px] text-zinc-500 mt-1">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Question Count */}
      <div className="space-y-3">
        <Label className="text-sm text-zinc-300 font-medium">Number of Questions</Label>
        <div className="flex flex-wrap gap-2">
          {countOptions.map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setCount(num)}
              className={`px-4 py-2 text-sm font-semibold rounded-xl border transition-all duration-200
                ${count === num
                  ? "border-violet-500 bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/30"
                  : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-300"
                }`}
            >
              {num} Qs
            </button>
          ))}
        </div>
      </div>

      {/* Context options */}
      <div className="space-y-4 pt-2 border-t border-white/[0.06]">
        {hasResources ? (
          <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-white/[0.06] bg-white/[0.01]">
            <div className="flex gap-2.5">
              <FileText className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <Label htmlFor="vault-ctx" className="text-sm text-zinc-300 font-medium cursor-pointer">
                  Use Vault Resources Context
                </Label>
                <p className="text-xs text-zinc-500 mt-0.5">
                  AI will read uploaded files in this vault to extract real facts and context for questions.
                </p>
              </div>
            </div>
            <button
              type="button"
              id="vault-ctx"
              onClick={() => setUseVaultContext(!useVaultContext)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0
                ${useVaultContext ? "bg-violet-600" : "bg-zinc-800"}`}
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
              No files uploaded to this vault yet. The AI will generate general textbook questions on the specified topic.
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
            placeholder="e.g. Focus on memory hierarchy. Avoid questions about disk storage."
            className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-violet-500/50 text-xs py-2"
          />
        </div>
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        disabled={isPending || !topics.trim()}
        className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-6 rounded-xl gap-2 transition-all hover:shadow-lg hover:shadow-violet-600/10"
      >
        {isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating MCQs (this may take a few seconds)...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate Quiz
            <ArrowRight className="w-4 h-4 ml-1" />
          </>
        )}
      </Button>
    </form>
  );
}
