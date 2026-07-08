"use client";

import { useRef } from "react";
import { Bold, Italic, Heading2, List, Code, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

/**
 * Markdown editor: a textarea (native undo/redo via Ctrl+Z/Y) plus a light
 * formatting toolbar that wraps/prefixes the current selection.
 */
export function NoteEditor({ value, onChange, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function surround(prefix: string, suffix = prefix) {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = value.slice(s, e) || "text";
    const next = value.slice(0, s) + prefix + sel + suffix + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = s + prefix.length;
      ta.selectionEnd = s + prefix.length + sel.length;
    });
  }

  function prefixLine(prefix: string) {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s } = ta;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s + prefix.length;
    });
  }

  const tools = [
    { icon: Bold, action: () => surround("**"), label: "Bold" },
    { icon: Italic, action: () => surround("*"), label: "Italic" },
    { icon: Heading2, action: () => prefixLine("## "), label: "Heading" },
    { icon: List, action: () => prefixLine("- "), label: "List" },
    { icon: Quote, action: () => prefixLine("> "), label: "Quote" },
    { icon: Code, action: () => surround("`"), label: "Code" },
  ];

  return (
    <div className={cn("flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.01]", className)}>
      <div className="flex items-center gap-0.5 border-b border-white/[0.06] px-2 py-1.5">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            onClick={t.action}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
          >
            <t.icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="min-h-[420px] flex-1 resize-none bg-transparent p-5 font-mono text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600"
        placeholder="Write in Markdown…"
      />
    </div>
  );
}
