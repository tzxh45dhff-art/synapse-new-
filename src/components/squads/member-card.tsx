"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Shield, ShieldAlert, UserMinus, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SquadMemberItem } from "@/types/squad";

const roleBadge: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  member: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  viewer: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

interface MemberCardProps {
  member: SquadMemberItem;
  currentUserRole: string;
  currentUserId: string;
  onChangeRole?: (userId: string, role: string) => void;
  onRemove?: (userId: string) => void;
}

export function MemberCard({
  member, currentUserRole, currentUserId, onChangeRole, onRemove,
}: MemberCardProps) {
  const profile = member.profile;
  const name = profile?.display_name || profile?.full_name || profile?.email || "Unknown";
  const initials = name.charAt(0).toUpperCase();
  const isCurrentUser = member.user_id === currentUserId;
  const canManage =
    !isCurrentUser &&
    (currentUserRole === "owner" || (currentUserRole === "admin" && member.role !== "owner" && member.role !== "admin"));

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/50 bg-card p-4 transition-colors hover:bg-card/80">
      <Avatar className="h-10 w-10">
        <AvatarImage src={profile?.avatar_url ?? undefined} />
        <AvatarFallback className="bg-muted text-sm font-medium">{initials}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          {isCurrentUser && (
            <span className="text-[10px] text-muted-foreground">(you)</span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
      </div>

      <Badge variant="outline" className={cn("shrink-0 text-[10px] font-medium capitalize", roleBadge[member.role])}>
        {member.role}
      </Badge>

      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {currentUserRole === "owner" && member.role !== "admin" && (
              <DropdownMenuItem onClick={() => onChangeRole?.(member.user_id, "admin")}>
                <Shield className="mr-2 h-3.5 w-3.5" /> Promote to Admin
              </DropdownMenuItem>
            )}
            {currentUserRole === "owner" && member.role === "admin" && (
              <DropdownMenuItem onClick={() => onChangeRole?.(member.user_id, "member")}>
                <ShieldAlert className="mr-2 h-3.5 w-3.5" /> Demote to Member
              </DropdownMenuItem>
            )}
            {member.role === "viewer" && (
              <DropdownMenuItem onClick={() => onChangeRole?.(member.user_id, "member")}>
                <Shield className="mr-2 h-3.5 w-3.5" /> Promote to Member
              </DropdownMenuItem>
            )}
            {member.role === "member" && (
              <DropdownMenuItem onClick={() => onChangeRole?.(member.user_id, "viewer")}>
                <ShieldAlert className="mr-2 h-3.5 w-3.5" /> Demote to Viewer
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onRemove?.(member.user_id)}
              className="text-destructive focus:text-destructive"
            >
              <UserMinus className="mr-2 h-3.5 w-3.5" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
