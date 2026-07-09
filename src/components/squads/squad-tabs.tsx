"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface SquadTabsProps {
  squadId: string;
}

const tabs = [
  { label: "Overview", href: "" },
  { label: "Members", href: "/members" },
  { label: "Settings", href: "/settings" },
];

export function SquadTabs({ squadId }: SquadTabsProps) {
  const pathname = usePathname();
  const base = `/dashboard/squads/${squadId}`;

  return (
    <div>
      <Link
        href="/dashboard/squads"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Squads
      </Link>
      <div className="border-b border-border/50">
      <nav className="-mb-px flex gap-6">
        {tabs.map((tab) => {
          const href = `${base}${tab.href}`;
          const isActive = tab.href === ""
            ? pathname === base
            : pathname.startsWith(href);

          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                "border-b-2 px-1 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      </div>
    </div>
  );
}
