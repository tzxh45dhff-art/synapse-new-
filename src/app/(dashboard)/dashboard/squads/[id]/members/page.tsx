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
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not logged in. Please sign in again.");
        return;
      }
      setCurrentUserId(user.id);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Session expired. Please sign in again.");
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
        "ngrok-skip-browser-warning": "true",
      };

      console.log("[Members] Fetching from:", apiBase);

      const [squadRes, membersRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/squads/${squadId}`, { headers }),
        fetch(`${apiBase}/api/v1/squads/${squadId}/members`, { headers }),
      ]);

      if (!squadRes.ok) {
        const body = await squadRes.text();
        console.error("[Members] Squad fetch failed:", squadRes.status, body);
        setError(`Failed to load squad (${squadRes.status}): ${body}`);
        return;
      }

      setSquad(await squadRes.json());

      if (!membersRes.ok) {
        const body = await membersRes.text();
        console.error("[Members] Members fetch failed:", membersRes.status, body);
        toast.error(`Failed to load members: ${membersRes.status}`);
      } else {
        setMembers(await membersRes.json());
      }
    } catch (err) {
      console.error("[Members] Network error:", err);
      setError(
        `Cannot reach backend. Make sure your backend is running.\n${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
    }
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

  if (error) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <SquadTabs squadId={squadId} />
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm text-red-400 whitespace-pre-wrap">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!squad) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{squad.name}</h1>
        <p className="text-sm text-white/50">
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
