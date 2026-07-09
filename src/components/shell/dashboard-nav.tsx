"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderClosed, Users, Settings, Sparkles } from "lucide-react";

export function DashboardNav() {
  const pathname = usePathname();
  const isDash = pathname === "/dashboard";
  const isVaults = pathname.startsWith("/dashboard/vaults");
  const isSquads = pathname.startsWith("/dashboard/squads");
  const isSettings = pathname.startsWith("/dashboard/settings");

  const item = (active: boolean) =>
    `flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${
      active ? "bg-violet-600/90 text-white" : "text-white/60 hover:bg-white/5"
    }`;

  return (
    <>
      {/* bottom nav */}
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-1 rounded-2xl border border-white/[0.08] bg-[#0d0b16]/90 px-2 py-2 backdrop-blur-xl sm:gap-2 sm:px-3">
          <Link href="/dashboard" className={item(isDash)}>
            <Home className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <Link href="/dashboard/vaults" className={item(isVaults)}>
            <FolderClosed className="h-4 w-4" /> <span className="hidden sm:inline">Vaults</span>
          </Link>
          <Link href="/dashboard/squads" className={item(isSquads)}>
            <Users className="h-4 w-4" /> <span className="hidden sm:inline">Squads</span>
          </Link>
          <Link href="/dashboard/settings" className={item(isSettings)}>
            <Settings className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
          </Link>
        </div>
      </div>

      {/* ask ai */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-1.5 sm:right-8">
        <button
          title="Coming soon"
          className="flex h-14 w-14 cursor-not-allowed items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/50 ring-4 ring-violet-500/20"
        >
          <Sparkles className="h-6 w-6" />
        </button>
        <span className="text-xs text-white/60">Ask AI</span>
      </div>
    </>
  );
}
