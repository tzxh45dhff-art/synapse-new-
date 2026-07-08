"use client";

import { cn } from "@/lib/utils";
import type { NoteGenerationSettings } from "@/types/notes";

interface Props {
  settings: NoteGenerationSettings;
  onChange: (s: NoteGenerationSettings) => void;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onSelect(o.value)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
              value === o.value
                ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
                : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-white/[0.12] hover:text-zinc-200",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GenerationSettingsPanel({ settings, onChange }: Props) {
  const set = <K extends keyof NoteGenerationSettings>(k: K, v: NoteGenerationSettings[K]) =>
    onChange({ ...settings, [k]: v });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Segmented
        label="Length"
        value={settings.length}
        onSelect={(v) => set("length", v)}
        options={[
          { value: "short", label: "Short" },
          { value: "medium", label: "Medium" },
          { value: "long", label: "Long" },
          { value: "comprehensive", label: "Comprehensive" },
        ]}
      />
      <Segmented
        label="Difficulty"
        value={settings.difficulty}
        onSelect={(v) => set("difficulty", v)}
        options={[
          { value: "beginner", label: "Beginner" },
          { value: "intermediate", label: "Intermediate" },
          { value: "advanced", label: "Advanced" },
        ]}
      />
      <Segmented
        label="Tone"
        value={settings.tone}
        onSelect={(v) => set("tone", v)}
        options={[
          { value: "neutral", label: "Neutral" },
          { value: "formal", label: "Formal" },
          { value: "casual", label: "Casual" },
          { value: "concise", label: "Concise" },
        ]}
      />
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-zinc-500">Language</p>
        <input
          value={settings.language}
          onChange={(e) => set("language", e.target.value)}
          className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500/50"
        />
      </div>

      <div className="flex items-center gap-4 sm:col-span-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={settings.exam_focus}
            onChange={(e) => set("exam_focus", e.target.checked)}
            className="accent-indigo-500"
          />
          Exam focus
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={settings.include_citations}
            onChange={(e) => set("include_citations", e.target.checked)}
            className="accent-indigo-500"
          />
          Include citations
        </label>
      </div>
    </div>
  );
}
