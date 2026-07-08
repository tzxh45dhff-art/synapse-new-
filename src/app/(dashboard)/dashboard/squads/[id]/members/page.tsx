"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { SquadTabs } from "@/components/squads/squad-tabs";
import { MemberCard } from "@/components/squads/member-card";
import { MemberListSkeleton } from "@/components/squads/squad-skeleton";
import { changeRole } from "@/app/actions/squads/change-role";
import { removeMember } from "@/app/actions/squads/remove-member";
import type { SquadDetail, SquadMemberItem } from "@/types/squad";

export default function MembersPage() {
  const params = useParams();
  const squadId = params.id as string;
  const [squad, setSquad] = useState<SquadDetail | null>(null);
  const [members, setMembers] = useState<SquadMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const headers = { Authorization: `Bearer ${session.access_token}` };

    const [squadRes, membersRes] = await Promise.all([
      fetch(`${apiBase}/api/v1/squads/${squadId}`, { headers }),
      fetch(`${apiBase}/api/v1/squads/${squadId}/members`, { headers }),
    ]);

    if (squadRes.ok) setSquad(await squadRes.json());
    if (membersRes.ok) setMembers(await membersRes.json());
    setLoading(false);
  }, [squadId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleChangeRole(userId: string, role: string) {
    const result = await changeRole(squadId, userId, role);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Role updated!");
    fetchData();
  }

  async function handleRemove(userId: string) {
    const result = await removeMember(squadId, userId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Member removed");
    fetchData();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8" />
        <MemberListSkeleton />
      </div>
    );
  }

  if (!squad) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{squad.name}</h1>
        <p className="text-sm text-muted-foreground">
          {members.length} member{members.length !== 1 ? "s" : ""}
        </p>
      </div>

      <SquadTabs squadId={squadId} />

      <div className="space-y-2">
        {members.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            currentUserRole={squad.current_user_role ?? "member"}
            currentUserId={currentUserId}
            onChangeRole={handleChangeRole}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </div>
  );
}
