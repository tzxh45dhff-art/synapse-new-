import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";
import { SquadCard } from "@/components/squads/squad-card";
import { EmptyState } from "@/components/squads/empty-state";
import { CreateSquadDialog } from "@/components/squads/create-squad-dialog";
import { JoinSquadDialog } from "@/components/squads/join-squad-dialog";
import { SquadGridSkeleton } from "@/components/squads/squad-skeleton";
import type { SquadListItem } from "@/types/squad";

export const metadata = {
  title: "Squads — Bunker",
  description: "Manage your study squads",
};

async function SquadsList() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return null;

  const result = await api.get<SquadListItem[]>("/api/v1/squads", {
    token: session.access_token,
  });

  const squads = (result.data ?? []).filter((s) => !s.is_personal);

  if (squads.length === 0) {
    return (
      <div className="flex flex-col items-center">
        <EmptyState
          title="No squads yet"
          description="Create your first study squad or join one with an invite code."
        />
        <div className="mt-6 flex gap-4">
          <JoinSquadDialog />
          <CreateSquadDialog />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {squads.map((squad, i) => (
        <SquadCard key={squad.id} squad={squad} index={i} />
      ))}
    </div>
  );
}

export default function SquadsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Squads</h1>
          <p className="text-sm text-muted-foreground">
            Your collaborative study groups
          </p>
        </div>
        <div className="flex items-center gap-2">
          <JoinSquadDialog />
          <CreateSquadDialog />
        </div>
      </div>

      {/* Grid */}
      <Suspense fallback={<SquadGridSkeleton />}>
        <SquadsList />
      </Suspense>
    </div>
  );
}
