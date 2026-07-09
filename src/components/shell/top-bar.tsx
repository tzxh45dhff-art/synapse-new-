"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Sparkles, ChevronDown, LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/actions/auth/sign-out";

interface TopBarProps {
  name: string;
  email: string;
  avatarUrl: string | null;
}

export function TopBar({ name, email, avatarUrl }: TopBarProps) {
  const router = useRouter();

  return (
    <header className="flex items-center justify-between">
      <Link href="/dashboard" className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
          <Sparkles className="h-5 w-5" />
        </div>
        <span className="text-xl font-bold tracking-wide">BUNKER</span>
      </Link>

      <div className="flex items-center gap-5">
        <span className="text-white/50" aria-hidden>
          <Bell className="h-5 w-5" />
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none">
            <Avatar className="h-10 w-10 ring-2 ring-white/10">
              <AvatarImage src={avatarUrl ?? undefined} alt={name} />
              <AvatarFallback className="bg-gradient-to-br from-violet-400 to-indigo-500 text-sm font-semibold text-white">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="h-4 w-4 text-white/60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="truncate text-sm font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2"
              onSelect={() => router.push("/dashboard/settings")}
            >
              <Settings className="h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-red-400 focus:text-red-400"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
