"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import type { ExportFormat } from "@/types/notes";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const FORMATS: { fmt: ExportFormat; label: string }[] = [
  { fmt: "markdown", label: "Markdown (.md)" },
  { fmt: "pdf", label: "PDF (.pdf)" },
  { fmt: "docx", label: "Word (.docx)" },
];

export function ExportMenu({ noteId, title }: { noteId: string; title: string }) {
  const [busy, setBusy] = useState(false);

  async function handleExport(fmt: ExportFormat) {
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${BACKEND_URL}/api/v1/notes/${noteId}/export?format=${fmt}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ext = fmt === "markdown" ? "md" : fmt;
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9 \-_]/gi, "_") || "note"}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy} className="gap-2 border-white/10">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 border-white/[0.08] bg-zinc-900 text-white">
        {FORMATS.map((f) => (
          <DropdownMenuItem key={f.fmt} onClick={() => handleExport(f.fmt)} className="cursor-pointer hover:bg-white/[0.06]">
            {f.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
