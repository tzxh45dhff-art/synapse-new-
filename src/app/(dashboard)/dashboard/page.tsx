import { createClient } from "@/lib/supabase/server";
import { authedApi } from "@/lib/server-api";
import { listVaults } from "@/app/actions/vaults/queries";
import type { SquadListItem } from "@/types/squad";
import {
  DashboardView,
  type VaultCardData,
  type Suggestion,
} from "@/components/dashboard/dashboard-view";

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const diffMs = Date.now() - then;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`;
  return `${Math.floor(days / 30)} month${days < 60 ? "" : "s"} ago`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName =
    user?.user_metadata?.display_name ??
    user?.user_metadata?.full_name ??
    user?.email?.split("@")[0] ??
    "there";

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

  const allVaults = squadsWithVaults
    .flatMap(({ squadId, vaults }) => vaults.map((v) => ({ squadId, vault: v })))
    .sort(
      (a, b) =>
        new Date(b.vault.updated_at).getTime() -
        new Date(a.vault.updated_at).getTime(),
    );

  const totalVaults = allVaults.length;
  const totalSquads = activeSquads.length;
  const totalResources = allVaults.reduce(
    (sum, { vault }) => sum + (vault.statistics?.resource_count ?? 0),
    0,
  );

  const vaultCards: VaultCardData[] = allVaults.slice(0, 3).map(({ squadId, vault }) => ({
    vaultId: vault.id,
    squadId,
    title: vault.title,
    subjectName: vault.subject?.name ?? null,
    resourceCount: vault.statistics?.resource_count ?? 0,
    lastOpened: formatRelative(vault.updated_at),
  }));

  const primaryVault = allVaults[0]
    ? { squadId: allVaults[0].squadId, vaultId: allVaults[0].vault.id, title: allVaults[0].vault.title }
    : null;

  // Real, data-derived suggestions — no fabricated numbers.
  const suggestions: Suggestion[] = [];
  if (allVaults.length > 0) {
    const staleVault = [...allVaults].sort(
      (a, b) => new Date(a.vault.updated_at).getTime() - new Date(b.vault.updated_at).getTime(),
    )[0];
    suggestions.push({
      kind: "stale",
      title: staleVault.vault.title,
      detail: `Not opened since ${formatRelative(staleVault.vault.updated_at)}`,
      squadId: staleVault.squadId,
      vaultId: staleVault.vault.id,
    });

    const resourcedVaults = [...allVaults]
      .filter((v) => (v.vault.statistics?.resource_count ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.vault.statistics?.resource_count ?? 0) - (a.vault.statistics?.resource_count ?? 0),
      );

    if (resourcedVaults[0]) {
      suggestions.push({
        kind: "notes",
        title: resourcedVaults[0].vault.title,
        detail: `${resourcedVaults[0].vault.statistics?.resource_count} resources ready`,
        squadId: resourcedVaults[0].squadId,
        vaultId: resourcedVaults[0].vault.id,
      });
    }

    const quizTarget = resourcedVaults[1] ?? resourcedVaults[0] ?? allVaults[0];
    if (quizTarget) {
      suggestions.push({
        kind: "quiz",
        title: quizTarget.vault.title,
        detail: "Practice with an AI quiz",
        squadId: quizTarget.squadId,
        vaultId: quizTarget.vault.id,
      });
    }
  }

  return (
    <DashboardView
      userName={userName}
      vaultCards={vaultCards}
      primaryVault={primaryVault}
      totalVaults={totalVaults}
      totalSquads={totalSquads}
      totalResources={totalResources}
      suggestions={suggestions}
    />
  );
}
