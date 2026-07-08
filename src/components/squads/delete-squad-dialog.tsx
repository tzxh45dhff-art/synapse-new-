"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Loader2 } from "lucide-react";
import { deleteSquad } from "@/app/actions/squads/delete-squad";

interface DeleteSquadDialogProps {
  squadId: string;
  squadName: string;
  children?: React.ReactNode;
}

export function DeleteSquadDialog({ squadId, squadName, children }: DeleteSquadDialogProps) {
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  async function handleDelete() {
    setLoading(true);
    const result = await deleteSquad(squadId);
    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {children ?? (
          <Button variant="destructive" size="sm" className="gap-2">
            <Trash2 className="h-4 w-4" /> Delete Squad
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{squadName}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. All vaults and resources within this squad will become inaccessible.
            Type <strong>{squadName}</strong> to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          placeholder={`Type "${squadName}" to confirm`}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={confirmation !== squadName || loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Forever
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
