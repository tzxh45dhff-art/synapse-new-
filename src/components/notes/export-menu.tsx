"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportNoteAction } from "@/app/actions/notes/queries";
import type { ExportFormat } from "@/types/notes";

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
      const { data, contentType } = await exportNoteAction(noteId, fmt);

      // Decode base64 to binary
      const byteCharacters = atob(data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: contentType });

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
