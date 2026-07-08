"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { transferOwnership } from "@/app/actions/squads/transfer-ownership";
import type { SquadMemberItem } from "@/types/squad";

interface TransferOwnershipDialogProps {
  squadId: string;
  members: SquadMemberItem[];
  currentUserId: string;
  children?: React.ReactNode;
}

export function TransferOwnershipDialog({
  squadId, members, currentUserId, children,
}: TransferOwnershipDialogProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const eligibleMembers = members.filter(
    (m) => m.user_id !== currentUserId && m.role !== "owner"
  );

  async function handleTransfer() {
    if (!selected) return;
    setLoading(true);
    const result = await transferOwnership(squadId, selected);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    toast.success("Ownership transferred!");
    setOpen(false);
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Crown className="h-4 w-4" /> Transfer Ownership
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Ownership</DialogTitle>
          <DialogDescription>
            Select a member to become the new owner. You will be demoted to admin.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 space-y-1 overflow-y-auto py-2">
          {eligibleMembers.map((m) => {
            const name = m.profile?.display_name || m.profile?.full_name || m.profile?.email || "Unknown";
            return (
              <button
                key={m.user_id}
                onClick={() => setSelected(m.user_id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  selected === m.user_id
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : "hover:bg-muted/50"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.role}</p>
                </div>
                {selected === m.user_id && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
          {eligibleMembers.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No eligible members to transfer ownership to.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleTransfer} disabled={!selected || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
