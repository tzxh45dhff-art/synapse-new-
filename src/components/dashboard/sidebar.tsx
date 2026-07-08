"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Users,
  FolderArchive,
  Settings,
  Plus,
  LogOut,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SquadAvatar } from "@/components/squads/squad-avatar";
import type { SquadListItem, SidebarUser } from "@/types/squad";

interface DashboardSidebarProps {
  squads: SquadListItem[];
  user: SidebarUser;
}

const navItems = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/dashboard/squads", icon: Users, label: "Squads" },
  { href: "/dashboard/vaults", icon: FolderArchive, label: "Vaults" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

function SidebarContent({
  squads,
  user,
  collapsed,
  onToggle,
}: DashboardSidebarProps & { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex h-14 items-center justify-between px-3">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/10">
                <span className="text-sm font-bold text-sidebar-primary">B</span>
              </div>
              <span className="text-sm font-semibold tracking-tight">
                Bunker
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              collapsed && "rotate-180"
            )}
          />
        </Button>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Squads List */}
      <div className="flex-1 overflow-hidden">
        {!collapsed && (
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              My Squads
            </span>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link href="/dashboard/squads">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-sidebar-foreground/40 hover:text-sidebar-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">New Squad</TooltipContent>
            </Tooltip>
          </div>
        )}
        <ScrollArea className="h-full px-2 pb-2">
          <div className="space-y-0.5">
            {squads
              .filter((s) => !s.is_personal)
              .map((squad) => {
                const isActive = pathname.includes(squad.id);
                const link = (
                  <Link
                    key={squad.id}
                    href={`/dashboard/squads/${squad.id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <SquadAvatar
                      name={squad.name}
                      avatarUrl={squad.avatar_url}
                      size="sm"
                    />
                    {!collapsed && (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {squad.name}
                        </p>
                        <p className="text-xs text-sidebar-foreground/40">
                          {squad.member_count} member
                          {squad.member_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={squad.id} delayDuration={0}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {squad.name}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return link;
              })}
            {squads.filter((s) => !s.is_personal).length === 0 && !collapsed && (
              <p className="px-3 py-4 text-center text-xs text-sidebar-foreground/30">
                No squads yet
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* User */}
      <div className="p-2">
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2",
            collapsed && "justify-center px-0"
          )}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user.avatar_url ?? undefined} />
            <AvatarFallback className="bg-sidebar-accent text-xs font-medium">
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-sidebar-foreground/40">
                {user.email}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardSidebar({ squads, user }: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 64 : 256 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden h-screen shrink-0 border-r border-sidebar-border md:block"
      >
        <SidebarContent
          squads={squads}
          user={user}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
      </motion.aside>

      {/* Mobile sidebar */}
      <div className="fixed left-4 top-3 z-40 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent
              squads={squads}
              user={user}
              collapsed={false}
              onToggle={() => {}}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
