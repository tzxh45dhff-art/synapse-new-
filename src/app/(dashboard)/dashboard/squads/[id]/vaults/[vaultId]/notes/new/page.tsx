"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { GenerationWizard } from "@/components/notes/generation-wizard";
import { listTemplates, listVaultResources } from "@/app/actions/notes/queries";
import type { PromptTemplate } from "@/types/notes";
import type { ResourceListItem } from "@/types/vault";

interface Props {
  params: { id: string; vaultId: string };
}

export default function NewNotePage({ params }: Props) {
  const { id: squadId, vaultId } = params;
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, r] = await Promise.all([listTemplates(), listVaultResources(vaultId)]);
        setTemplates(t);
        setResources(r);
      } catch {
        toast.error("Failed to load the generator.");
      } finally {
        setLoading(false);
      }
    })();
  }, [vaultId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/squads/${squadId}/vaults/${vaultId}/notes`}
          className="text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-white">Generate notes</h1>
          <p className="text-sm text-zinc-500">Grounded in your vault. Streamed live.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
          <Skeleton className="h-[600px] rounded-2xl" />
          <Skeleton className="h-[600px] rounded-2xl" />
        </div>
      ) : (
        <GenerationWizard
          vaultId={vaultId}
          squadId={squadId}
          resources={resources}
          templates={templates}
        />
      )}
    </div>
  );
}
