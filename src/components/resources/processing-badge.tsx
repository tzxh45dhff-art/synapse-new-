"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ProcessingStage } from "@/types/vault";
import { STAGE_LABELS } from "@/types/vault";

const STAGE_STYLES: Record<ProcessingStage, { bg: string; text: string; dot: string }> = {
  uploaded:   { bg: "bg-zinc-800",         text: "text-zinc-400", dot: "bg-zinc-500" },
  validating: { bg: "bg-blue-950/60",      text: "text-blue-400", dot: "bg-blue-400" },
  extracting: { bg: "bg-amber-950/60",     text: "text-amber-400", dot: "bg-amber-400" },
  chunking:   { bg: "bg-purple-950/60",    text: "text-purple-400", dot: "bg-purple-400" },
  embedding:  { bg: "bg-violet-950/60",    text: "text-violet-400", dot: "bg-violet-400" },
  complete:   { bg: "bg-emerald-950/60",   text: "text-emerald-400", dot: "bg-emerald-400" },
  failed:     { bg: "bg-red-950/60",       text: "text-red-400", dot: "bg-red-500" },
  cancelled:  { bg: "bg-zinc-800",         text: "text-zinc-500", dot: "bg-zinc-600" },
};

const PULSING_STAGES: ProcessingStage[] = ["validating", "extracting", "chunking", "embedding"];

interface ProcessingBadgeProps {
  stage: ProcessingStage;
  showLabel?: boolean;
}

export function ProcessingBadge({ stage, showLabel = true }: ProcessingBadgeProps) {
  const style = STAGE_STYLES[stage];
  const isPulsing = PULSING_STAGES.includes(stage);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={stage}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs
          font-medium ${style.bg} ${style.text} border border-white/[0.05]`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}
          ${isPulsing ? "animate-pulse" : ""}`} />
        {showLabel && STAGE_LABELS[stage]}
      </motion.span>
    </AnimatePresence>
  );
}
