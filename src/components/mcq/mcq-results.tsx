"use client";

import { Award, RefreshCw, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  score: number;
  total: number;
  onRetry: () => void;
  onBackToWizard: () => void;
}

export function MCQResults({ score, total, onRetry, onBackToWizard }: Props) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  let title = "Practice Session Completed!";
  let message = "Good effort! Practice makes perfect. Review the explanations below and try again to improve your score.";
  let colorClass = "from-amber-500/20 to-yellow-500/10 border-amber-500/20 text-amber-400";
  let Icon = AlertTriangle;

  if (percentage >= 80) {
    title = "Excellent Job!";
    message = "You have demonstrated mastery over these concepts. Excellent recall and application!";
    colorClass = "from-emerald-500/20 to-green-500/10 border-emerald-500/20 text-emerald-400";
    Icon = Award;
  } else if (percentage >= 50) {
    title = "Great Effort!";
    message = "You have a solid foundation but there are some minor gaps. Try reviewing the explanations below.";
    colorClass = "from-blue-500/20 to-indigo-500/10 border-blue-500/20 text-blue-400";
    Icon = CheckCircle2;
  }

  return (
    <div className="max-w-xl mx-auto text-center space-y-8 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 sm:p-8 backdrop-blur-md">
      {/* Banner */}
      <div className={`p-6 rounded-2xl border bg-gradient-to-br flex flex-col items-center justify-center gap-3 ${colorClass}`}>
        <Icon className="w-12 h-12" />
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">{message}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
          <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider block mb-1">Your Score</span>
          <span className="text-3xl font-extrabold text-white font-mono">{score} <span className="text-zinc-600 text-xl">/ {total}</span></span>
        </div>
        <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
          <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider block mb-1">Accuracy</span>
          <span className="text-3xl font-extrabold text-white font-mono">{percentage}%</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-white/[0.06]">
        <Button
          onClick={onRetry}
          variant="outline"
          className="flex-1 gap-2 border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-zinc-300 py-6 rounded-xl"
        >
          <RefreshCw className="w-4 h-4" />
          Retake This Quiz
        </Button>
        <Button
          onClick={onBackToWizard}
          className="flex-1 gap-2 bg-violet-600 hover:bg-violet-500 text-white py-6 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          New Configuration
        </Button>
      </div>
    </div>
  );
}
