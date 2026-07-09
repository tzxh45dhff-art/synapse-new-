import { Suspense } from "react";
import { listVaults, listSubjects } from "@/app/actions/vaults/queries";
import { VaultCard } from "@/components/vaults/vault-card";
import { VaultGridSkeleton } from "@/components/vaults/vault-skeleton";
import { VaultEmptyState } from "@/components/vaults/vault-empty-state";
import { CreateVaultDialog } from "@/components/vaults/create-vault-dialog";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ archived?: string; q?: string }>;
}

async function VaultGrid({ squadId, search, archived }: {
  squadId: string; search?: string; archived: boolean;
}) {
  const vaults = await listVaults(squadId, {
    search,
    includeArchived: archived,
  }).catch(() => []);

  if (!vaults.length) {
    return <VaultEmptyState showArchived={archived} />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {vaults.map((vault, i) => (
        <VaultCard key={vault.id} vault={vault} squadId={squadId} index={i} />
      ))}
    </div>
  );
}

export default async function VaultsPage({ params, searchParams }: Props) {
  const { id: squadId } = await params;
  const { archived, q } = await searchParams;
  const showArchived = archived === "true";

  const subjects = await listSubjects().catch(() => []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Vaults</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Collaborative workspaces for each subject
          </p>
        </div>
        <CreateVaultDialog squadId={squadId} subjects={subjects} />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <form className="flex-1">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search vaults…"
            className="w-full max-w-xs px-3 py-2 rounded-lg text-sm
              bg-white/[0.04] border border-white/[0.08] text-white
              placeholder:text-zinc-600 outline-none focus:border-violet-500/50"
          />
        </form>
        <a
          href={`?${showArchived ? "" : "archived=true"}`}
          className={`px-3 py-2 rounded-lg text-sm border transition-colors
            ${showArchived
              ? "border-violet-500/40 text-violet-400 bg-violet-950/20"
              : "border-white/[0.08] text-zinc-500 hover:text-zinc-300 bg-white/[0.02]"}`}
        >
          {showArchived ? "Hide Archived" : "Show Archived"}
        </a>
      </div>

      <Suspense fallback={<VaultGridSkeleton />}>
        <VaultGrid squadId={squadId} search={q} archived={showArchived} />
      </Suspense>
    </div>
  );
}
