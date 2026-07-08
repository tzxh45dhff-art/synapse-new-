"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2 } from "lucide-react";
import { createSquad } from "@/app/actions/squads/create-squad";

interface CreateSquadDialogProps {
  children?: React.ReactNode;
}

export function CreateSquadDialog({ children }: CreateSquadDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    if (!name.trim()) {
      toast.error("Squad name is required");
      setLoading(false);
      return;
    }

    if (name.length > 100) {
      toast.error("Squad name must be 100 characters or less");
      setLoading(false);
      return;
    }

    const result = await createSquad({
      name: name.trim(),
      description: description?.trim() || undefined,
    });

    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    toast.success("Squad created!");
    setOpen(false);
    setLoading(false);

    if (result.data && typeof result.data === "object" && "id" in result.data) {
      router.push(`/dashboard/squads/${(result.data as { id: string }).id}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Create Squad
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new squad</DialogTitle>
          <DialogDescription>
            Start a study group for your team, class, or project.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Squad name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. DSA Study Group"
              maxLength={100}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="What's this squad about?"
              rows={3}
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Squad
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
