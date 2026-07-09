import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";
import { SquadsView } from "@/components/squads/squads-view";
import type { SquadListItem } from "@/types/squad";

export const metadata = {
  title: "Squads — Bunker",
  description: "Manage your study squads",
};

export default async function SquadsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let squads: SquadListItem[] = [];
  if (session) {
    const result = await api.get<SquadListItem[]>("/api/v1/squads", {
      token: session.access_token,
    });
    squads = (result.data ?? []).filter((s) => !s.is_personal);
  }

  return <SquadsView squads={squads} />;
}
