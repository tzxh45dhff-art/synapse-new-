"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InviteCodeCardProps {
  inviteCode: string;
  squadId: string;
  canRegenerate?: boolean;
  onRegenerate?: () => Promise<void>;
}

export function InviteCodeCard({
  inviteCode,
  squadId,
  canRegenerate = false,
  onRegenerate,
}: InviteCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast.success("Invite code copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyLink() {
    const url = `${window.location.origin}/dashboard/squads/invite/${inviteCode}`;
    await navigator.clipboard.writeText(url);
    toast.success("Invite link copied!");
  }

  async function handleRegenerate() {
    if (!onRegenerate) return;
    setRegenerating(true);
    try {
      await onRegenerate();
      toast.success("Invite code regenerated!");
    } catch {
      toast.error("Failed to regenerate code");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-muted-foreground">Invite Code</h4>
        {canRegenerate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="h-7 gap-1.5 text-xs text-muted-foreground"
          >
            <RefreshCw className={cn("h-3 w-3", regenerating && "animate-spin")} />
            Regenerate
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-lg bg-muted/50 px-4 py-3 text-center">
          <span className="font-mono text-xl font-bold tracking-[0.3em] text-foreground">
            {inviteCode}
          </span>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={copyCode}
          className="h-12 w-12 shrink-0"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={copyLink}
        className="mt-3 w-full text-xs text-muted-foreground"
      >
        Copy invite link
      </Button>
    </div>
  );
}
