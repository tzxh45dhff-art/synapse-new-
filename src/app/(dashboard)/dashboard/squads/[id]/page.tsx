import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";
import { SquadHeader } from "@/components/squads/squad-header";
import { SquadTabs } from "@/components/squads/squad-tabs";
import { InviteCodeCard } from "@/components/squads/invite-code-card";
import { Separator } from "@/components/ui/separator";
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
  const canManageInvites = squad.current_user_role === "owner" || squad.current_user_role === "admin";

  return (
    <div className="space-y-6">
      <SquadHeader squad={squad} />
      <SquadTabs squadId={squad.id} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content area */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <h3 className="text-lg font-semibold">Overview</h3>
            <Separator className="my-4" />
            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Description</span>
                <p className="mt-1 text-sm">{squad.description || "No description yet."}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Created</span>
                <p className="mt-1 text-sm">
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
              canRegenerate={squad.current_user_role === "owner" || squad.current_user_role === "admin"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
