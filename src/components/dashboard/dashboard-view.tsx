"use client";

import { useState } from "react";
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
  TrendingUp,
  Activity,
  Flame,
  Award,
  RefreshCw,
  Lightbulb,
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
    <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-md transition-all hover:border-white/[0.1] ${className}`}>
      {children}
    </div>
  );
}

const SUGGESTION_META: Record<
  Suggestion["kind"],
  { icon: React.ComponentType<{ className?: string }>; c: string; verb: string; hrefSuffix: string }
> = {
  stale: { icon: Brain, c: "text-pink-400 bg-pink-500/15 border-pink-500/20", verb: "Revisit", hrefSuffix: "" },
  notes: { icon: FileText, c: "text-sky-400 bg-sky-500/15 border-sky-500/20", verb: "Generate notes for", hrefSuffix: "/notes/new" },
  quiz: { icon: HelpCircle, c: "text-amber-400 bg-amber-500/15 border-amber-500/20", verb: "Take a quiz on", hrefSuffix: "/mcq" },
};

// Simulated flashcards for quick recall
const FLASHCARDS = [
  { term: "Pointer Arithmetic (C++)", def: "Adding integers to pointers shifts the memory address by that many multiples of the data type size (e.g. ptr + 1)." },
  { term: "BFS Time Complexity", def: "O(V + E) where V is the number of vertices and E is the number of edges in the graph." },
  { term: "Memory Leak", def: "Occurs when memory allocated on the heap (using new/malloc) is not deallocated (using delete/free) before the pointer is lost." },
  { term: "Trace Question Tip", def: "Trace output line-by-line using a manual stack frame diagram to avoid missing nested loop iterations." },
];

export function DashboardView({
  userName,
  vaultCards,
  primaryVault,
  totalVaults,
  totalSquads,
  totalResources,
  suggestions,
}: DashboardViewProps) {
  const [flashcardIdx, setFlashcardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const vaultBase = primaryVault
    ? `/dashboard/squads/${primaryVault.squadId}/vaults/${primaryVault.vaultId}`
    : null;
  const resumeHref = vaultBase ?? "/dashboard/vaults";

  const cardStyles = [
    { icon: Monitor, tint: "text-violet-400", bar: "from-violet-500 to-indigo-500", bg: "bg-violet-500/10" },
    { icon: Database, tint: "text-sky-400", bar: "from-sky-500 to-blue-500", bg: "bg-sky-500/10" },
    { icon: Code2, tint: "text-emerald-400", bar: "from-emerald-500 to-green-500", bg: "bg-emerald-500/10" },
  ];

  const stats = [
    { icon: FolderClosed, label: "Vaults", value: totalVaults, tint: "text-violet-400", bg: "bg-violet-500/15" },
    { icon: FileStack, label: "Resources", value: totalResources, tint: "text-sky-400", bg: "bg-sky-500/15" },
    { icon: Users, label: "Squads", value: totalSquads, tint: "text-emerald-400", bg: "bg-emerald-500/15" },
  ];

  // Simulated activity heatmap for past 16 weeks (7 rows, 16 columns)
  const heatmapRows = 7;
  const heatmapCols = 16;
  const heatmapCells = Array.from({ length: heatmapRows * heatmapCols }, (_, i) => {
    // Generate a mock activity level (0: empty, 1: low, 2: medium, 3: high)
    const seed = (i * 7 + 13) % 100;
    if (seed < 50) return 0;
    if (seed < 75) return 1;
    if (seed < 90) return 2;
    return 3;
  });

  const getHeatmapColor = (level: number) => {
    switch (level) {
      case 1: return "bg-emerald-950/40 border border-emerald-500/10";
      case 2: return "bg-emerald-700/40 border border-emerald-500/20";
      case 3: return "bg-emerald-500/60 border border-emerald-400/40 shadow-sm shadow-emerald-500/10";
      default: return "bg-white/[0.02] border border-white/[0.04]";
    }
  };

  const nextFlashcard = () => {
    setFlipped(false);
    setTimeout(() => {
      setFlashcardIdx((prev) => (prev + 1) % FLASHCARDS.length);
    }, 150);
  };

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
      
      {/* ── Greeting ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Good to see you, {userName} 👋</h1>
          <p className="mt-1 text-sm text-zinc-500">Here&apos;s where things stand across your vaults and squads.</p>
        </div>

        {/* Quick Streak Indicator */}
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 max-w-fit">
          <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
          <div>
            <p className="text-xs text-zinc-400 font-semibold leading-none">3 Day Streak</p>
            <p className="text-[10px] text-zinc-500 mt-1">Keep practicing to hold streak!</p>
          </div>
        </div>
      </div>

      {/* ── Resume + Quick Stats Row ── */}
      <div className="grid grid-cols-12 gap-4">
        <Link
          href={resumeHref}
          className="col-span-12 flex items-center justify-between rounded-2xl bg-gradient-to-r from-violet-700 to-indigo-700 px-6 py-5 shadow-lg shadow-violet-900/30 transition-all hover:scale-[1.01] active:scale-[0.99] hover:shadow-violet-950/40 lg:col-span-6"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-200">
              {primaryVault ? "Continue Where You Left Off" : "Get Started"}
            </p>
            <p className="mt-1 text-xl font-extrabold text-white">
              {primaryVault?.title ?? "Create your first vault"}
            </p>
          </div>
          <span className="flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/20 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
            <Play className="h-4 w-4 fill-white text-white" /> Resume
          </span>
        </Link>

        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Panel key={s.label} className="col-span-4 lg:col-span-2 flex flex-col justify-center">
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bg} border border-white/[0.04]`}>
                  <Icon className={`h-5 w-5 ${s.tint}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none text-white">{s.value}</p>
                  <p className="text-xs text-zinc-500 font-medium mt-1">{s.label}</p>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {/* ── Main content grid: Two Columns ── */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* ── LEFT AREA (Column span 7) ── */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          
          {/* Continue Learning Grid */}
          <Panel>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Continue Learning</h3>
              </div>
              <Link
                href="/dashboard/vaults"
                className="flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300"
              >
                View All <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {vaultCards.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                {vaultCards.map((card, i) => {
                  const st = cardStyles[i % cardStyles.length];
                  const Icon = st.icon;
                  return (
                    <Link
                      key={card.vaultId}
                      href={`/dashboard/squads/${card.squadId}/vaults/${card.vaultId}`}
                      className="group rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5 transition-all hover:border-white/[0.15] hover:bg-white/[0.04] flex flex-col justify-between"
                    >
                      <div>
                        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${st.bg} border border-white/[0.04] transition-all group-hover:scale-105`}>
                          <Icon className={`h-5 w-5 ${st.tint}`} />
                        </div>
                        <p className="truncate text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">{card.title}</p>
                        {card.subjectName && (
                          <p className="truncate text-[11px] text-zinc-500 mt-0.5">{card.subjectName}</p>
                        )}
                      </div>
                      
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1.5 font-medium">
                          <span>{card.resourceCount} {card.resourceCount === 1 ? "file" : "files"}</span>
                          <span>Opened {card.lastOpened}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${st.bar}`}
                            style={{ width: card.resourceCount > 0 ? "100%" : "8%" }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Link
                href="/dashboard/vaults"
                className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.01] px-6 py-10 text-center transition-all hover:bg-white/[0.03] hover:border-white/20"
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/5">
                  <BookOpen className="h-5 w-5 text-violet-400" />
                </div>
                <p className="text-sm font-semibold text-white">No active study vaults yet</p>
                <p className="mt-1 text-xs text-zinc-500">Create your first study vault to start generating MCQs and Coding questions!</p>
              </Link>
            )}
          </Panel>

          {/* Activity Heatmap Widget (Practice Tracker) */}
          <Panel>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Practice Tracker</h3>
              </div>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Consistency Map</span>
            </div>

            <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
              {/* Daily labels */}
              <div className="grid grid-rows-7 gap-[3px] text-[9px] font-semibold text-zinc-600 mt-6 shrink-0 font-mono">
                <span>Mon</span>
                <span className="opacity-0">Tue</span>
                <span>Wed</span>
                <span className="opacity-0">Thu</span>
                <span>Fri</span>
                <span className="opacity-0">Sat</span>
                <span>Sun</span>
              </div>

              {/* Grid map */}
              <div className="flex-1 overflow-x-auto">
                <div className="grid grid-flow-col grid-rows-7 gap-[3px] min-w-[280px]">
                  {heatmapCells.map((level, idx) => (
                    <div
                      key={idx}
                      className={`h-[11px] w-[11px] rounded-[2px] transition-all hover:scale-110 cursor-pointer ${getHeatmapColor(level)}`}
                      title={`Activity level: ${level}`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-[9px] text-zinc-500 mt-3 font-semibold px-1">
                  <span>16 weeks ago</span>
                  <div className="flex items-center gap-1.5">
                    <span>Less</span>
                    <div className="h-2 w-2 rounded-[1px] bg-white/[0.02] border border-white/[0.04]" />
                    <div className="h-2 w-2 rounded-[1px] bg-emerald-950/40 border border-emerald-500/10" />
                    <div className="h-2 w-2 rounded-[1px] bg-emerald-700/40 border border-emerald-500/20" />
                    <div className="h-2 w-2 rounded-[1px] bg-emerald-500/60 border border-emerald-400/40" />
                    <span>More</span>
                  </div>
                  <span>Today</span>
                </div>
              </div>
            </div>
          </Panel>

          {/* Quick Recall flipping flashcard widget */}
          <Panel>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Quick Recall</h3>
              </div>
              <button
                onClick={nextFlashcard}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Flashcard Box */}
            <div
              onClick={() => setFlipped(!flipped)}
              className="group relative h-28 w-full cursor-pointer overflow-hidden rounded-xl border border-white/[0.06] bg-black/15 transition-all duration-300 hover:border-white/[0.12] hover:bg-black/30"
            >
              {/* Front view */}
              <div className={`absolute inset-0 flex flex-col justify-center p-5 transition-all duration-300
                ${flipped ? "opacity-0 translate-y-2 pointer-events-none" : "opacity-100 translate-y-0"}`}>
                <span className="text-[9px] font-bold tracking-widest text-yellow-500 uppercase">Interactive Flashcard</span>
                <h4 className="text-base font-bold text-white mt-1.5 group-hover:text-yellow-400 transition-colors">
                  {FLASHCARDS[flashcardIdx].term}
                </h4>
                <p className="text-[10px] text-zinc-500 mt-2 font-medium">Click card to reveal definition/answer...</p>
              </div>

              {/* Back view */}
              <div className={`absolute inset-0 flex flex-col justify-center p-5 transition-all duration-300 bg-yellow-500/[0.02]
                ${flipped ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}`}>
                <span className="text-[9px] font-bold tracking-widest text-emerald-400 uppercase">Definition</span>
                <p className="text-xs sm:text-sm text-zinc-300 mt-1.5 leading-relaxed">
                  {FLASHCARDS[flashcardIdx].def}
                </p>
              </div>
            </div>
          </Panel>
        </div>

        {/* ── RIGHT AREA (Column span 5) ── */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          
          {/* Da Vinci AI Insights & Concept Mastery */}
          <Panel>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-400" />
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">AI Study Insights</h3>
              </div>
              <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20 uppercase">
                Premium
              </span>
            </div>

            <div className="flex items-center gap-5 pt-1.5">
              {/* Circle progress ring */}
              <div className="relative h-20 w-20 shrink-0 flex items-center justify-center">
                <svg className="absolute transform -rotate-90" width="80" height="80">
                  <circle cx="40" cy="40" r="34" className="stroke-white/[0.04]" strokeWidth="6" fill="transparent" />
                  <circle cx="40" cy="40" r="34" className="stroke-violet-500" strokeWidth="6" fill="transparent"
                    strokeDasharray="213.6" strokeDashoffset="59.8" strokeLinecap="round" />
                </svg>
                <div className="text-center">
                  <p className="text-base font-extrabold text-white leading-none">72%</p>
                  <p className="text-[8px] text-zinc-500 font-bold mt-1 uppercase tracking-wider">Mastery</p>
                </div>
              </div>

              {/* Bullet details */}
              <div className="space-y-2.5">
                <div className="flex gap-2">
                  <Award className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300">Strongest concept</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Pointer syntax (C++) — 90% accuracy</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300">Practice Goal</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Attempt 2 more coding traces today</p>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* Performance Trend SVG Graph */}
          <Panel>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-400" />
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Practice Scores</h3>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold">+12% this week</span>
            </div>

            {/* SVG line chart */}
            <div className="h-28 w-full pt-2">
              <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal grid lines */}
                <line x1="0" y1="20" x2="300" y2="20" className="stroke-white/[0.03]" strokeWidth="1" />
                <line x1="0" y1="50" x2="300" y2="50" className="stroke-white/[0.03]" strokeWidth="1" />
                <line x1="0" y1="80" x2="300" y2="80" className="stroke-white/[0.03]" strokeWidth="1" />

                {/* Fill area */}
                <path d="M 0 90 L 50 80 L 100 85 L 150 60 L 200 45 L 250 35 L 300 10 L 300 100 L 0 100 Z" fill="url(#chartGrad)" />
                {/* Path line */}
                <path d="M 0 90 L 50 80 L 100 85 L 150 60 L 200 45 L 250 35 L 300 10" fill="none" className="stroke-violet-500" strokeWidth="2.5" />
                
                {/* Dots on points */}
                <circle cx="50" cy="80" r="3" fill="#8b5cf6" className="stroke-zinc-950" strokeWidth="1.5" />
                <circle cx="100" cy="85" r="3" fill="#8b5cf6" className="stroke-zinc-950" strokeWidth="1.5" />
                <circle cx="150" cy="60" r="3" fill="#8b5cf6" className="stroke-zinc-950" strokeWidth="1.5" />
                <circle cx="200" cy="45" r="3" fill="#8b5cf6" className="stroke-zinc-950" strokeWidth="1.5" />
                <circle cx="250" cy="35" r="3" fill="#8b5cf6" className="stroke-zinc-950" strokeWidth="1.5" />
                <circle cx="300" cy="10" r="3" fill="#8b5cf6" className="stroke-zinc-950" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="flex justify-between text-[8px] font-bold text-zinc-500 mt-2 font-mono uppercase tracking-widest px-1">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </Panel>

          {/* Suggestions List (derived from active vaults) */}
          <Panel>
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Suggestions</h3>
              </div>
              <Link href="/dashboard/vaults" className="text-xs font-semibold text-violet-400 hover:text-violet-300">
                View All
              </Link>
            </div>

            <div className="space-y-2.5">
              {suggestions.length > 0 ? (
                suggestions.map((s, i) => {
                  const meta = SUGGESTION_META[s.kind];
                  const Icon = meta.icon;
                  return (
                    <Link
                      key={`${s.kind}-${s.vaultId}-${i}`}
                      href={`/dashboard/squads/${s.squadId}/vaults/${s.vaultId}${meta.hrefSuffix}`}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.01] p-3 text-left hover:bg-white/[0.04] transition-all"
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${meta.c}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-semibold text-white/90">
                          {meta.verb} {s.title}
                        </p>
                        <p className="truncate text-[10px] text-zinc-500 mt-0.5">{s.detail}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                    </Link>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Sparkles className="w-6 h-6 text-zinc-600 mb-2" />
                  <p className="text-xs text-zinc-500 leading-normal">
                    AI suggestions appear once you have active study vaults with resources.
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </div>

      </div>
    </div>
  );
}
