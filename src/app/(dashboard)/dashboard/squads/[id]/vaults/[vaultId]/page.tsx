import { notFound } from "next/navigation";
import Link from "next/link";
import { getVault } from "@/app/actions/vaults/queries";
import { listResources } from "@/app/actions/resources/queries";
import { VaultHeader } from "@/components/vaults/vault-header";
import { ResourceCard } from "@/components/resources/resource-card";
import { Button } from "@/components/ui/button";
import { Upload, Library, FileText, ListChecks, Terminal } from "lucide-react";
import type { VaultDetail, ResourceListItem } from "@/types/vault";

const STUDY_TOOLS = [
  {
    seg: "notes",
    label: "AI Notes",
    description: "Turn your uploads into structured, exportable notes.",
    Icon: FileText,
    accent: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
  {
    seg: "mcq",
    label: "MCQ Practice",
    description: "Quiz yourself on this vault's material, with explanations.",
    Icon: ListChecks,
    accent: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  {
    seg: "coding",
    label: "Coding Questions",
    description: "Solve problems in an editor that really runs your code.",
    Icon: Terminal,
    accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
] as const;

interface Props {
  params: Promise<{ id: string; vaultId: string }>;
}

export default async function VaultDashboardPage({ params }: Props) {
  const { id: squadId, vaultId } = await params;

  const [vault, recentResources] = await Promise.all([
    getVault(vaultId).catch(() => null) as Promise<VaultDetail | null>,
    listResources(vaultId).catch(() => [] as ResourceListItem[]),
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

      {/* Study tools — the point of a vault, one click from here */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Study Tools
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STUDY_TOOLS.map(({ seg, label, description, Icon, accent }) => (
            <Link
              key={seg}
              href={`/dashboard/squads/${squadId}/vaults/${vaultId}/${seg}`}
              className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5
                transition-all hover:border-white/[0.12] hover:bg-white/[0.04]"
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${accent}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-white group-hover:text-white">{label}</p>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{description}</p>
            </Link>
          ))}
        </div>
      </section>

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
