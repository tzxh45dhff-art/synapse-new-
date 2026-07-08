"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SquadAvatar } from "@/components/squads/squad-avatar";
import type { SquadListItem } from "@/types/squad";

const roleBadgeVariants: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  member: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  viewer: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

interface SquadCardProps {
  squad: SquadListItem;
  index?: number;
}

export function SquadCard({ squad, index = 0 }: SquadCardProps) {
  const role = squad.current_user_role ?? "member";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link href={`/dashboard/squads/${squad.id}`}>
        <div
          className={cn(
            "group relative overflow-hidden rounded-xl border border-border/50 bg-card p-5",
            "transition-all duration-300",
            "hover:border-border hover:bg-card/80 hover:shadow-lg hover:shadow-black/5",
            "hover:-translate-y-0.5"
          )}
        >
          {/* Subtle gradient glow on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div className="relative flex items-start gap-4">
            <SquadAvatar
              name={squad.name}
              avatarUrl={squad.avatar_url}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {squad.name}
                </h3>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[10px] font-medium capitalize",
                    roleBadgeVariants[role]
                  )}
                >
                  {role}
                </Badge>
              </div>

              {squad.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {squad.description}
                </p>
              )}

              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/60">
                <Users className="h-3.5 w-3.5" />
                <span>
                  {squad.member_count} member
                  {squad.member_count !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
