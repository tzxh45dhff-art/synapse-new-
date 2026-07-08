"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const gradients = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-orange-500 to-amber-500",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-blue-600",
  "from-fuchsia-500 to-purple-500",
  "from-sky-500 to-blue-500",
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface SquadAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

export function SquadAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: SquadAvatarProps) {
  const gradient = getGradient(name);

  return (
    <Avatar className={cn(sizes[size], "shrink-0 rounded-xl", className)}>
      <AvatarImage src={avatarUrl ?? undefined} className="rounded-xl" />
      <AvatarFallback
        className={cn(
          "rounded-xl bg-gradient-to-br font-semibold text-white",
          gradient
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
