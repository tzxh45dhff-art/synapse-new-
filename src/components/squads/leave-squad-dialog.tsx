"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { leaveSquad } from "@/app/actions/squads/leave-squad";

interface LeaveSquadDialogProps {
  squadId: string;
  squadName: string;
  children?: React.ReactNode;
}

export function LeaveSquadDialog({ squadId, squadName, children }: LeaveSquadDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleLeave() {
    setLoading(true);
    const result = await leaveSquad(squadId);
    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
            <LogOut className="h-4 w-4" /> Leave Squad
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave &quot;{squadName}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            You will lose access to all vaults and resources in this squad. You can rejoin later with an invite code.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLeave}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Leave Squad
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
