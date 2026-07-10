"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { ChatCitation } from "@/types/chat";
import { getResourceDownloadUrl } from "@/app/actions/resources/queries";

interface ChatReferenceCardProps {
  citation: ChatCitation;
  onNavigate?: () => void;
}

export function ChatReferenceCard({ citation, onNavigate }: ChatReferenceCardProps) {
  const [opening, setOpening] = useState(false);
  const vaultHref = `/dashboard/squads/${citation.squad_id}/vaults/${citation.vault_id}`;

  async function handleOpenResource(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (opening) return;
    setOpening(true);
    try {
      const { download_url } = await getResourceDownloadUrl(citation.resource_id);
      window.open(download_url, "_blank");
    } catch {
      toast.error("Failed to open source file.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <Link
      href={vaultHref}
      onClick={onNavigate}
      className="group flex items-center gap-2.5 rounded-xl border border-violet-500/20 bg-violet-500/[0.06]
        px-3 py-2 text-xs transition hover:border-violet-500/40 hover:bg-violet-500/[0.1]"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-white/90">{citation.resource_title}</span>
        <span className="block truncate text-white/40">{citation.vault_title}</span>
      </span>
      <button
        type="button"
        title="Open source file"
        onClick={handleOpenResource}
        disabled={opening}
        className="shrink-0 rounded-lg p-1.5 text-white/40 opacity-0 transition
          hover:bg-white/10 hover:text-white group-hover:opacity-100 disabled:opacity-50"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </Link>
  );
}
