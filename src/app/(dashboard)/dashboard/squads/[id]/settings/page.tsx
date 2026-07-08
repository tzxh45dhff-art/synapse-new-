"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { SquadTabs } from "@/components/squads/squad-tabs";
import { DeleteSquadDialog } from "@/components/squads/delete-squad-dialog";
import { LeaveSquadDialog } from "@/components/squads/leave-squad-dialog";
import { TransferOwnershipDialog } from "@/components/squads/transfer-ownership-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save } from "lucide-react";
import { updateSquad } from "@/app/actions/squads/update-squad";
import type { SquadDetail, SquadMemberItem } from "@/types/squad";

export default function SettingsPage() {
  const params = useParams();
  const squadId = params.id as string;
  const [squad, setSquad] = useState<SquadDetail | null>(null);
  const [members, setMembers] = useState<SquadMemberItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

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
  }, [squadId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const result = await updateSquad(squadId, {
      name: (formData.get("name") as string).trim(),
      description: (formData.get("description") as string).trim() || undefined,
      max_members: parseInt(formData.get("max_members") as string) || undefined,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Settings saved!");
      fetchData();
    }
    setSaving(false);
  }

  if (!squad) return null;

  const isOwner = squad.current_user_role === "owner";
  const isAdmin = squad.current_user_role === "admin" || isOwner;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{squad.name}</h1>
        <p className="text-sm text-muted-foreground">Squad settings</p>
      </div>

      <SquadTabs squadId={squadId} />

      {/* General settings */}
      {isAdmin && (
        <div className="rounded-xl border border-border/50 bg-card p-6">
          <h3 className="text-lg font-semibold">General</h3>
          <Separator className="my-4" />
          <form onSubmit={handleSave} className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label htmlFor="name">Squad name</Label>
              <Input id="name" name="name" defaultValue={squad.name} maxLength={100} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={squad.description ?? ""}
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_members">Max members</Label>
              <Input
                id="max_members"
                name="max_members"
                type="number"
                defaultValue={squad.max_members}
                min={1}
                max={500}
              />
            </div>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </form>
        </div>
      )}

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/20 bg-card p-6">
        <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
        <Separator className="my-4" />
        <div className="space-y-4">
          {isOwner && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Transfer Ownership</p>
                <p className="text-xs text-muted-foreground">
                  Hand over ownership to another member
                </p>
              </div>
              <TransferOwnershipDialog
                squadId={squadId}
                members={members}
                currentUserId={currentUserId}
              />
            </div>
          )}

          {!isOwner && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Leave Squad</p>
                <p className="text-xs text-muted-foreground">
                  You will lose access to all resources
                </p>
              </div>
              <LeaveSquadDialog squadId={squadId} squadName={squad.name} />
            </div>
          )}

          {isOwner && !squad.is_personal && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Delete Squad</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete this squad and all its data
                  </p>
                </div>
                <DeleteSquadDialog squadId={squadId} squadName={squad.name} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
