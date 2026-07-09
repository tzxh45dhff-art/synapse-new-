import { authedApi } from "@/lib/server-api";
import { listVaults } from "@/app/actions/vaults/queries";
import { VaultsView, type VaultTab } from "@/components/vaults/vaults-view";
import type { SquadListItem } from "@/types/squad";

export const metadata = {
  title: "Vaults — Bunker",
  description: "Access all your study vaults across all squads",
};

export default async function VaultsPage() {
  const api = await authedApi();
  const squads = await api
    .get<SquadListItem[]>("/squads")
    .catch(() => [] as SquadListItem[]);
  const activeSquads = squads.filter((s) => !s.is_personal);

  const squadsWithVaults = await Promise.all(
    activeSquads.map(async (squad) => ({
      squadId: squad.id,
      vaults: await listVaults(squad.id).catch(() => []),
    })),
  );

  const vaults: VaultTab[] = squadsWithVaults
    .flatMap(({ squadId, vaults }) => vaults.map((v) => ({ squadId, vault: v })))
    .sort(
      (a, b) =>
        new Date(b.vault.updated_at).getTime() -
        new Date(a.vault.updated_at).getTime(),
    )
    .map(({ squadId, vault }) => ({
      vaultId: vault.id,
      squadId,
      title: vault.title,
      subjectName: vault.subject?.name ?? null,
      description: vault.description,
      resourceCount: vault.statistics?.resource_count ?? 0,
    }));

  return <VaultsView vaults={vaults} />;
}
