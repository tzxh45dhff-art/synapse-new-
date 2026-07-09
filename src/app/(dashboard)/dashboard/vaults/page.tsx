import { Suspense } from "react";
import Link from "next/link";
import { FolderArchive, ArrowRight } from "lucide-react";
import { listVaults } from "@/app/actions/vaults/queries";
import { authedApi } from "@/lib/server-api";
import { VaultCard } from "@/components/vaults/vault-card";
import { VaultGridSkeleton } from "@/components/vaults/vault-skeleton";
import { Button } from "@/components/ui/button";
import type { SquadListItem } from "@/types/squad";

export const metadata = {
  title: "Vaults — Bunker",
  description: "Access all your study vaults across all squads",
};

async function VaultsContent() {
  const api = await authedApi();
  const squads = await api.get<SquadListItem[]>("/squads").catch(() => []);
  const activeSquads = squads.filter((s) => !s.is_personal);

  if (activeSquads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/30 px-8 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
          <FolderArchive className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">No squads yet</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          You need to be part of a study squad to access vaults. Create or join a squad first!
        </p>
        <Link href="/dashboard/squads" className="mt-6">
          <Button size="sm">Go to Squads</Button>
        </Link>
      </div>
    );
  }

  const squadsWithVaults = await Promise.all(
    activeSquads.map(async (squad) => {
      const vaults = await listVaults(squad.id).catch(() => []);
      return { squad, vaults };
    })
  );

  const hasAnyVaults = squadsWithVaults.some(({ vaults }) => vaults.length > 0);

  if (!hasAnyVaults) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/30 px-8 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
          <FolderArchive className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">No vaults yet</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Create vaults inside your squads to start organizing your files, study guides, and notes.
        </p>
        <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Select a Squad to Create a Vault:
          </p>
          {activeSquads.map((squad) => (
            <Link
              key={squad.id}
              href={`/dashboard/squads/${squad.id}/vaults`}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <span>{squad.name}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {squadsWithVaults
        .filter(({ vaults }) => vaults.length > 0)
        .map(({ squad, vaults }) => (
          <div key={squad.id} className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <Link
                href={`/dashboard/squads/${squad.id}`}
                className="hover:underline"
              >
                <h2 className="text-lg font-semibold text-white">
                  {squad.name}
                </h2>
              </Link>
              <Link href={`/dashboard/squads/${squad.id}/vaults`}>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-white">
                  Manage Vaults
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vaults.map((vault, i) => (
                <VaultCard
                  key={vault.id}
                  vault={vault}
                  squadId={squad.id}
                  index={i}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

export default function VaultsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Vaults</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Access all your study vaults across all squads
        </p>
      </div>

      <Suspense fallback={<VaultGridSkeleton />}>
        <VaultsContent />
      </Suspense>
    </div>
  );
}
