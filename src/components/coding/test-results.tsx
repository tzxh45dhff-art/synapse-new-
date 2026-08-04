"use client";

import { useState } from "react";
import { Check, X, Lock, Minus, Clock } from "lucide-react";
import type { CodingTestResult } from "@/types/coding";

interface Props {
  results: CodingTestResult[];
}

function statusIcon(result: CodingTestResult) {
  if (result.skipped) return <Minus className="w-3 h-3 text-zinc-600" />;
  if (result.passed) return <Check className="w-3 h-3 text-green-400" />;
  return <X className="w-3 h-3 text-red-400" />;
}

function Field({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad";
}) {
  const toneClass =
    tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : "text-zinc-300";
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
        {label}
      </span>
      <pre
        className={`p-2.5 rounded-lg bg-black/40 border border-white/[0.05] text-[11px] leading-relaxed whitespace-pre-wrap break-all overflow-x-auto max-h-40 ${toneClass}`}
      >
        {value}
      </pre>
    </div>
  );
}

/**
 * Per-test-case breakdown of a graded submission. Cases that are still hidden
 * show only their verdict — the values live on the server so a hardcoded
 * answer can't be reverse-engineered from this panel.
 *
 * Remounted per grading run (keyed by the caller), so the opening tab is
 * chosen once: the first failure, since that is the case worth reading.
 */
export function TestResults({ results }: Props) {
  const [active, setActive] = useState(() => {
    const firstFailure = results.findIndex((r) => !r.passed && !r.skipped);
    return firstFailure >= 0 ? firstFailure : 0;
  });

  if (results.length === 0) return null;

  const current = results[Math.min(active, results.length - 1)];

  return (
    <div className="space-y-3">
      {/* Case selector */}
      <div className="flex flex-wrap gap-1.5">
        {results.map((result, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all
              ${
                i === active
                  ? "bg-white/[0.07] border-white/[0.12] text-white"
                  : "bg-white/[0.02] border-white/[0.05] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
              }`}
          >
            {statusIcon(result)}
            <span>Case {i + 1}</span>
            {result.hidden && <Lock className="w-2.5 h-2.5 text-zinc-600" />}
          </button>
        ))}
      </div>

      {/* Selected case detail */}
      {current && (
        <div className="space-y-2.5 rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span
              className={`text-xs font-bold ${
                current.skipped
                  ? "text-zinc-500"
                  : current.passed
                    ? "text-green-400"
                    : "text-red-400"
              }`}
            >
              {current.skipped ? "Not run" : current.passed ? "Passed" : "Failed"}
              {current.name ? ` · ${current.name}` : ""}
            </span>
            {current.duration_ms > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-600 font-mono">
                <Clock className="w-2.5 h-2.5" />
                {current.duration_ms} ms
              </span>
            )}
          </div>

          {current.hidden ? (
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Hidden test case. Its input and expected value stay on the server so a
              hardcoded answer can&apos;t pass — solve the problem in general and it will
              go green.
            </p>
          ) : (
            <div className="space-y-2.5">
              {current.input_display != null && (
                <Field label="Input" value={current.input_display} />
              )}
              {current.expected_display != null && (
                <Field label="Expected" value={current.expected_display} tone="good" />
              )}
              {current.actual_display != null && (
                <Field
                  label="Your output"
                  value={current.actual_display}
                  tone={current.passed ? "good" : "bad"}
                />
              )}
              {current.stdout && (
                <Field label="Printed (stdout)" value={current.stdout} />
              )}
            </div>
          )}

          {current.error && (
            <Field label="Error" value={current.error} tone="bad" />
          )}
        </div>
      )}
    </div>
  );
}
