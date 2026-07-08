"use client";

import { SquadAvatar } from "@/components/squads/squad-avatar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SquadDetail } from "@/types/squad";

const roleBadge: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  member: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  viewer: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export function SquadHeader({ squad }: { squad: SquadDetail }) {
  const role = squad.current_user_role ?? "member";

  return (
    <div className="flex items-start gap-5">
      <SquadAvatar name={squad.name} avatarUrl={squad.avatar_url} size="xl" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <h1 className="truncate text-2xl font-bold">{squad.name}</h1>
          <Badge
            variant="outline"
            className={cn("shrink-0 text-xs font-medium capitalize", roleBadge[role])}
          >
            {role}
          </Badge>
        </div>
        {squad.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {squad.description}
          </p>
        )}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <Users className="h-3.5 w-3.5" />
          <span>
            {squad.member_count} / {squad.max_members} members
          </span>
        </div>
      </div>
    </div>
  );
}
