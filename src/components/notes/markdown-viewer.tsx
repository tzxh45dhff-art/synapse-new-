"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Compact, dependency-free GitHub-flavored-markdown renderer.
 * Supports headings, lists, ordered lists, tables, fenced code, blockquotes,
 * horizontal rules, and inline bold/italic/code/links + [n] citation markers.
 * Content is our own trusted LLM output; we still never use dangerouslySetInnerHTML.
 */

let keySeq = 0;
const nextKey = () => `md-${keySeq++}`;

// ── Inline ────────────────────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Order matters: code first so ** inside code is ignored.
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*|_[^_]+_)|(\[[^\]]+\]\([^)]+\))|(\[\d+\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code key={nextKey()} className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[0.85em] text-emerald-300">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={nextKey()} className="font-semibold text-white">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("[") && token.includes("](")) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)!;
      nodes.push(
        <a key={nextKey()} href={mm[2]} target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-2 hover:text-sky-300">
          {mm[1]}
        </a>,
      );
    } else if (/^\[\d+\]$/.test(token)) {
      nodes.push(
        <sup key={nextKey()} className="ml-0.5 rounded bg-indigo-500/20 px-1 text-[0.65em] font-medium text-indigo-300">
          {token.slice(1, -1)}
        </sup>,
      );
    } else {
      nodes.push(<em key={nextKey()} className="italic text-zinc-200">{token.slice(1, -1)}</em>);
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// ── Block parsing ───────────────────────────────────────────────────────────────
function MarkdownBlocks({ source }: { source: string }): React.ReactElement {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  const isTableSep = (s: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(s) && s.includes("-");

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") { i++; continue; }

    // Fenced code
    if (trimmed.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      i++; // closing fence
      blocks.push(
        <pre key={nextKey()} className="my-3 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/40 p-3 text-xs leading-relaxed text-zinc-200">
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) {
      const level = h[1].length;
      const sizes = ["text-2xl", "text-xl", "text-lg", "text-base", "text-sm", "text-sm"];
      blocks.push(
        React.createElement(
          `h${level}`,
          { key: nextKey(), className: cn("mt-5 mb-2 font-semibold text-white", sizes[level - 1]) },
          renderInline(h[2]),
        ),
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={nextKey()} className="my-4 border-white/[0.08]" />);
      i++;
      continue;
    }

    // Table
    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = trimmed.split("|").slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].trim().split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      blocks.push(
        <div key={nextKey()} className="my-3 overflow-x-auto rounded-lg border border-white/[0.06]">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-zinc-300">
              <tr>{header.map((c, x) => <th key={x} className="px-3 py-2 font-medium">{renderInline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, y) => (
                <tr key={y} className="border-t border-white/[0.05]">
                  {r.map((c, x) => <td key={x} className="px-3 py-2 text-zinc-400">{renderInline(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={nextKey()} className="my-3 border-l-2 border-indigo-500/50 bg-white/[0.02] py-1.5 pl-4 text-zinc-300">
          {quote.map((q, x) => <p key={x}>{renderInline(q)}</p>)}
        </blockquote>,
      );
      continue;
    }

    // Lists (unordered / ordered)
    const ulMatch = /^([-*+])\s+/.test(trimmed);
    const olMatch = /^\d+\.\s+/.test(trimmed);
    if (ulMatch || olMatch) {
      const items: React.ReactNode[] = [];
      const ordered = olMatch;
      while (i < lines.length) {
        const t = lines[i].trim();
        const um = /^[-*+]\s+(.*)$/.exec(t);
        const om = /^\d+\.\s+(.*)$/.exec(t);
        if (!um && !om) break;
        items.push(<li key={nextKey()} className="ml-1">{renderInline((um ?? om)![1])}</li>);
        i++;
      }
      blocks.push(
        ordered
          ? <ol key={nextKey()} className="my-2 list-decimal space-y-1 pl-6 text-zinc-300">{items}</ol>
          : <ul key={nextKey()} className="my-2 list-disc space-y-1 pl-6 text-zinc-300">{items}</ul>,
      );
      continue;
    }

    // Paragraph (gather consecutive text lines)
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|```|>|[-*+]\s|\d+\.\s|\|)/.test(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) {
      blocks.push(<p key={nextKey()} className="my-2 leading-relaxed text-zinc-300">{renderInline(para.join(" "))}</p>);
    }
  }

  return <>{blocks}</>;
}

export function MarkdownViewer({ content, className }: { content: string; className?: string }) {
  if (!content?.trim()) {
    return <p className={cn("text-sm text-zinc-600", className)}>Nothing here yet.</p>;
  }
  return (
    <div className={cn("text-[0.95rem]", className)}>
      <MarkdownBlocks source={content} />
    </div>
  );
}
