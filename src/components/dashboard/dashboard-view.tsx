"use client";

import Link from "next/link";
import {
  ChevronRight,
  Play,
  FolderClosed,
  FileStack,
  Users,
  Sparkles,
  Brain,
  FileText,
  HelpCircle,
  Monitor,
  Database,
  Code2,
  BookOpen,
} from "lucide-react";

export interface VaultCardData {
  vaultId: string;
  squadId: string;
  title: string;
  subjectName: string | null;
  resourceCount: number;
  lastOpened: string;
}

export interface Suggestion {
  kind: "stale" | "notes" | "quiz";
  title: string;
  detail: string;
  squadId: string;
  vaultId: string;
}

interface PrimaryVault {
  squadId: string;
  vaultId: string;
  title: string;
}

interface DashboardViewProps {
  userName: string;
  vaultCards: VaultCardData[];
  primaryVault: PrimaryVault | null;
  totalVaults: number;
  totalSquads: number;
  totalResources: number;
  suggestions: Suggestion[];
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

const SUGGESTION_META: Record<
  Suggestion["kind"],
  { icon: React.ComponentType<{ className?: string }>; c: string; verb: string; hrefSuffix: string }
> = {
  stale: { icon: Brain, c: "text-pink-400 bg-pink-500/15", verb: "Revisit", hrefSuffix: "" },
  notes: { icon: FileText, c: "text-sky-400 bg-sky-500/15", verb: "Generate notes for", hrefSuffix: "/notes/new" },
  quiz: { icon: HelpCircle, c: "text-amber-400 bg-amber-500/15", verb: "Take a quiz on", hrefSuffix: "/mcq" },
};

export function DashboardView({
  userName,
  vaultCards,
  primaryVault,
  totalVaults,
  totalSquads,
  totalResources,
  suggestions,
}: DashboardViewProps) {
  const vaultBase = primaryVault
    ? `/dashboard/squads/${primaryVault.squadId}/vaults/${primaryVault.vaultId}`
    : null;
  const resumeHref = vaultBase ?? "/dashboard/vaults";

  const cardStyles = [
    { icon: Monitor, tint: "text-violet-400", bar: "from-violet-500 to-indigo-500" },
    { icon: Database, tint: "text-sky-400", bar: "from-sky-500 to-blue-500" },
    { icon: Code2, tint: "text-emerald-400", bar: "from-emerald-500 to-green-500" },
  ];

  const stats = [
    { icon: FolderClosed, label: "Vaults", value: totalVaults, tint: "text-violet-400", bg: "bg-violet-500/15" },
    { icon: FileStack, label: "Resources", value: totalResources, tint: "text-sky-400", bg: "bg-sky-500/15" },
    { icon: Users, label: "Squads", value: totalSquads, tint: "text-emerald-400", bg: "bg-emerald-500/15" },
  ];

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
      {/* greeting */}
      <div>
        <h1 className="text-3xl font-bold">Good to see you, {userName} 👋</h1>
        <p className="mt-1 text-sm text-white/50">Here&apos;s where things stand across your vaults and squads.</p>
      </div>

      {/* resume + real stats row */}
      <div className="grid grid-cols-12 gap-4">
        <Link
          href={resumeHref}
          className="col-span-12 flex items-center justify-between rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5 shadow-lg shadow-violet-900/40 transition hover:opacity-90 lg:col-span-6"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-200">
              {primaryVault ? "Continue Where You Left Off" : "Get Started"}
            </p>
            <p className="mt-1 text-xl font-bold">
              {primaryVault?.title ?? "Create your first vault"}
            </p>
          </div>
          <span className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold">
            <Play className="h-4 w-4 fill-white" /> Resume
          </span>
        </Link>

        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Panel key={s.label} className="col-span-4 lg:col-span-2">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>
                  <Icon className={`h-5 w-5 ${s.tint}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{s.value}</p>
                  <p className="text-xs text-white/50">{s.label}</p>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {/* continue learning + suggestions */}
      <div className="grid grid-cols-12 gap-4">
        <Panel className="col-span-12 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Continue Learning</h3>
            <Link
              href="/dashboard/vaults"
              className="flex items-center gap-1 text-xs text-violet-400 hover:underline"
            >
              View All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {vaultCards.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {vaultCards.map((card, i) => {
                const st = cardStyles[i % cardStyles.length];
                const Icon = st.icon;
                return (
                  <Link
                    key={card.vaultId}
                    href={`/dashboard/squads/${card.squadId}/vaults/${card.vaultId}`}
                    className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-white/15 hover:bg-white/[0.05]"
                  >
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                      <Icon className={`h-5 w-5 ${st.tint}`} />
                    </div>
                    <p className="truncate text-sm font-medium">{card.title}</p>
                    {card.subjectName && (
                      <p className="truncate text-[11px] text-white/40">{card.subjectName}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${st.bar}`}
                          style={{ width: card.resourceCount > 0 ? "100%" : "8%" }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-[10px] text-white/50">
                        {card.resourceCount} {card.resourceCount === 1 ? "file" : "files"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[10px] text-white/40">Opened {card.lastOpened}</p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Link
              href="/dashboard/vaults"
              className="mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-8 text-center transition hover:bg-white/[0.04]"
            >
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                <BookOpen className="h-5 w-5 text-violet-400" />
              </div>
              <p className="text-sm font-medium">No vaults yet</p>
              <p className="mt-1 text-xs text-white/40">Create your first vault to start learning</p>
            </Link>
          )}
        </Panel>

        {/* suggestions — derived from real vault data */}
        <Panel className="col-span-12 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <h3 className="font-semibold">Suggestions</h3>
            </div>
            <Link href="/dashboard/vaults" className="text-xs text-violet-400 hover:underline">
              View All
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {suggestions.length > 0 ? (
              suggestions.map((s, i) => {
                const meta = SUGGESTION_META[s.kind];
                const Icon = meta.icon;
                return (
                  <Link
                    key={`${s.kind}-${s.vaultId}-${i}`}
                    href={`/dashboard/squads/${s.squadId}/vaults/${s.vaultId}${meta.hrefSuffix}`}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:bg-white/5"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.c}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium text-white/85">
                        {meta.verb} {s.title}
                      </p>
                      <p className="truncate text-[10px] text-white/40">{s.detail}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
                  </Link>
                );
              })
            ) : (
              <p className="py-6 text-center text-xs text-white/40">
                Suggestions appear once you have vaults with resources.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
