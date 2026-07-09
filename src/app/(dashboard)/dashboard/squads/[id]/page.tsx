import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";
import { SquadHeader } from "@/components/squads/squad-header";
import { SquadTabs } from "@/components/squads/squad-tabs";
import { InviteCodeCard } from "@/components/squads/invite-code-card";
import type { SquadDetail } from "@/types/squad";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { title: "Squad — Bunker" };

  const result = await api.get<SquadDetail>(`/api/v1/squads/${id}`, {
    token: session.access_token,
  });

  return {
    title: result.data ? `${result.data.name} — Bunker` : "Squad — Bunker",
  };
}

export default async function SquadDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return notFound();

  const result = await api.get<SquadDetail>(`/api/v1/squads/${id}`, {
    token: session.access_token,
  });

  if (!result.data) return notFound();

  const squad = result.data;
  const canManageInvites =
    squad.current_user_role === "owner" || squad.current_user_role === "admin";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SquadHeader squad={squad} />
      <SquadTabs squadId={squad.id} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content area */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold">Overview</h3>
            <div className="my-4 h-px bg-white/[0.06]" />
            <div className="space-y-4">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-white/40">
                  Description
                </span>
                <p className="mt-1 text-sm text-white/80">
                  {squad.description || "No description yet."}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-white/40">
                  Created
                </span>
                <p className="mt-1 text-sm text-white/80">
                  {new Date(squad.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {canManageInvites && (
            <InviteCodeCard
              inviteCode={squad.invite_code}
              squadId={squad.id}
              canRegenerate={canManageInvites}
            />
          )}
        </div>
      </div>
    </div>
  );
}
