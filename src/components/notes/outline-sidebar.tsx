"use client";

import { cn } from "@/lib/utils";

interface Heading {
  level: number;
  text: string;
  id: string;
}

function extractHeadings(md: string): Heading[] {
  const out: Heading[] = [];
  let inCode = false;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) { inCode = !inCode; continue; }
    if (inCode) continue;
    const m = /^(#{1,4})\s+(.*)$/.exec(line);
    if (m) {
      const text = m[2].replace(/[*`_]/g, "").trim();
      out.push({ level: m[1].length, text, id: text.toLowerCase().replace(/[^a-z0-9]+/g, "-") });
    }
  }
  return out;
}

export function OutlineSidebar({ content }: { content: string }) {
  const headings = extractHeadings(content);
  if (headings.length === 0) {
    return <p className="text-xs text-zinc-600">No headings yet.</p>;
  }
  return (
    <nav className="space-y-1">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Outline</p>
      {headings.map((h, i) => (
        <p
          key={i}
          className={cn(
            "truncate text-xs text-zinc-500 transition-colors hover:text-zinc-300",
            h.level === 1 && "font-medium text-zinc-400",
          )}
          style={{ paddingLeft: `${(h.level - 1) * 10}px` }}
        >
          {h.text}
        </p>
      ))}
    </nav>
  );
}
