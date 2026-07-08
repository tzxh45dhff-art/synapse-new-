import { notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { VaultHeader } from "@/components/vaults/vault-header";
import { ResourceCard } from "@/components/resources/resource-card";
import { Button } from "@/components/ui/button";
import { Upload, Library } from "lucide-react";
import type { VaultDetail, ResourceListItem } from "@/types/vault";

interface Props {
  params: Promise<{ id: string; vaultId: string }>;
}

export default async function VaultDashboardPage({ params }: Props) {
  const { id: squadId, vaultId } = await params;

  const [vault, recentResources] = await Promise.all([
    api.get<VaultDetail>(`/vaults/${vaultId}`).catch(() => null),
    api.get<ResourceListItem[]>(`/vaults/${vaultId}/resources`).catch(() => []),
  ]);

  if (!vault) notFound();

  const recent = recentResources.slice(0, 5);

  return (
    <div className="space-y-10">
      <VaultHeader vault={vault} squadId={squadId} />

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link href={`/dashboard/squads/${squadId}/vaults/${vaultId}/resources`}>
          <Button className="gap-2 bg-violet-600 hover:bg-violet-500 text-white">
            <Upload className="w-4 h-4" /> Upload Resources
          </Button>
        </Link>
        <Link href={`/dashboard/squads/${squadId}/vaults/${vaultId}/resources`}>
          <Button variant="outline"
            className="gap-2 border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]">
            <Library className="w-4 h-4" /> Browse Resources
          </Button>
        </Link>
      </div>

      {/* Recent resources */}
      {recent.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              Recent Resources
            </h2>
            <Link href={`/dashboard/squads/${squadId}/vaults/${vaultId}/resources`}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {recent.map((resource, i) => (
              <ResourceCard key={resource.id} resource={resource} index={i} />
            ))}
          </div>
        </section>
      )}

      {recent.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06]
            flex items-center justify-center mb-4">
            <Library className="w-6 h-6 text-zinc-600" />
          </div>
          <p className="text-sm text-zinc-500">No resources yet.</p>
          <p className="text-xs text-zinc-600 mt-1">
            Upload your first file to get started.
          </p>
        </div>
      )}
    </div>
  );
}
