"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Lock, Zap, Rocket, FileStack, FileText, Gauge, Timer, BookOpen, Plus } from "lucide-react";
import { CreateVaultGlobalDialog } from "@/components/vaults/create-vault-global-dialog";
import type { SquadListItem } from "@/types/squad";

export interface VaultTab {
  vaultId: string;
  squadId: string;
  title: string;
  subjectName: string | null;
  description: string | null;
  resourceCount: number;
}

interface VaultsViewProps {
  vaults: VaultTab[];
  squads: SquadListItem[];
}

// --- deterministic per-vault "random" data -------------------------------
// Seeded off the vault id so numbers stay stable across renders/reloads but
// differ from vault to vault (and any newly created vault gets its own set).
// Mocked for now until per-vault mastery tracking ships.

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rng: () => number, min: number, max: number) =>
  Math.floor(rng() * (max - min + 1)) + min;

const RADAR_LABELS = ["CONCEPTS", "EXAM READINESS", "QUIZZES", "CODE LABS", "FLASHCARDS"];

const SUBJECT_PRESETS: Record<string, { phase: string; state: string }> = {
  java: { phase: "Object-Oriented Design", state: "High Performance State" },
  "c++": { phase: "Pointers & Memory Model", state: "Low-Level Focus" },
  c: { phase: "Memory Management", state: "Systems Level Focus" },
  python: { phase: "Scripting & Automation", state: "Steady Progress" },
  dsa: { phase: "Algorithm Optimization", state: "Peak Focus" },
  "data structures": { phase: "Algorithm Optimization", state: "Peak Focus" },
  os: { phase: "Process Scheduling", state: "Deep Systems Mode" },
  "operating systems": { phase: "Process Scheduling", state: "Deep Systems Mode" },
  dbms: { phase: "Query Optimization", state: "Structured Learning" },
  "database management systems": { phase: "Query Optimization", state: "Structured Learning" },
  networks: { phase: "Protocol Analysis", state: "Connected & Focused" },
  "computer networks": { phase: "Protocol Analysis", state: "Connected & Focused" },
  "cloud computing": { phase: "Infrastructure Design", state: "Scaling Up" },
  "web development": { phase: "Full-Stack Integration", state: "Building Momentum" },
  "machine learning": { phase: "Model Training", state: "Deep Learning Mode" },
  "artificial intelligence": { phase: "Search & Inference", state: "Deep Learning Mode" },
};

const FALLBACK_PHASES = [
  { phase: "Concept Mastery", state: "Steady Progress" },
  { phase: "Active Recall", state: "Building Momentum" },
  { phase: "Applied Practice", state: "Deep Focus Mode" },
  { phase: "Review Cycle", state: "High Performance State" },
];

function getVaultStats(seedKey: string, subjectName: string | null, title: string) {
  const rng = mulberry32(hashSeed(seedKey));
  const radarAxes = RADAR_LABELS.map((label) => ({ label, value: randInt(rng, 55, 96) }));
  const completion = randInt(rng, 40, 95);
  const modules = randInt(rng, 6, 20);
  const avgScore = randInt(rng, 60, 96);
  const studyHours = randInt(rng, 4, 42);
  const studyMinutes = randInt(rng, 0, 59);
  const sectorNum = String(randInt(rng, 1, 12)).padStart(2, "0");
  const sectorLetter = String.fromCharCode(65 + randInt(rng, 0, 4));

  const key = (subjectName ?? title).trim().toLowerCase();
  const preset =
    SUBJECT_PRESETS[key] ??
    Object.entries(SUBJECT_PRESETS).find(([k]) => key.includes(k))?.[1] ??
    FALLBACK_PHASES[randInt(rng, 0, FALLBACK_PHASES.length - 1)];

  return {
    radarAxes,
    completion,
    modules,
    avgScore,
    studyTime: `${studyHours}h ${studyMinutes}m`,
    sector: `${sectorNum}-${sectorLetter}`,
    phase: preset.phase,
    state: preset.state,
  };
}

function RadarChart({ axes }: { axes: { label: string; value: number }[] }) {
  const cx = 240;
  const cy = 210;
  const R = 130;
  const n = axes.length;

  const point = (i: number, f: number) => {
    const angle = (-90 + (i * 360) / n) * (Math.PI / 180);
    return [cx + R * f * Math.cos(angle), cy + R * f * Math.sin(angle)];
  };

  const ringPoly = (f: number) =>
    axes.map((_, i) => point(i, f).join(",")).join(" ");

  const dataPoly = axes.map((a, i) => point(i, a.value / 100).join(",")).join(" ");

  return (
    <svg viewBox="0 0 480 440" className="h-full w-full">
      <defs>
        <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ringPoly(f)} fill="none" stroke="#ffffff14" strokeWidth="1" />
      ))}

      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#ffffff10" strokeWidth="1" />;
      })}

      <polygon points={dataPoly} fill="url(#radarFill)" stroke="#a78bfa" strokeWidth="2" />
      {axes.map((a, i) => {
        const [x, y] = point(i, a.value / 100);
        return <circle key={i} cx={x} cy={y} r="4" fill="#c4b5fd" />;
      })}

      {axes.map((a, i) => {
        const [x, y] = point(i, 1.28);
        return (
          <g key={i}>
            <text x={x} y={y - 4} textAnchor="middle" className="fill-white/50 text-[11px] font-medium tracking-wide">
              {a.label}
            </text>
            <text x={x} y={y + 14} textAnchor="middle" className="fill-white text-[15px] font-bold">
              {a.value}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function VaultsView({ vaults, squads }: VaultsViewProps) {
  const [active, setActive] = useState(0);

  if (vaults.length === 0) {
    return (
      <div className="mx-auto mt-24 flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15">
          <BookOpen className="h-8 w-8 text-violet-400" />
        </div>
        <h2 className="text-2xl font-bold">No vaults yet</h2>
        <p className="mt-2 max-w-sm text-sm text-white/50">
          Vaults live inside your squads. Open a squad to create your first vault and start
          building your knowledge base.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/dashboard/squads"
            className="rounded-xl bg-zinc-900 border border-white/[0.08] hover:bg-zinc-800 text-white px-6 py-3 text-sm font-semibold transition"
          >
            Go to Squads
          </Link>
          <CreateVaultGlobalDialog
            squads={squads}
            trigger={
              <button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-semibold hover:opacity-90 transition flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Create Vault
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const v = vaults[active];
  const vaultHref = `/dashboard/squads/${v.squadId}/vaults/${v.vaultId}`;
  const words = v.title.trim().split(/\s+/);
  const head = words.slice(0, -1).join(" ");
  const tail = words[words.length - 1];
  const stats = getVaultStats(v.vaultId, v.subjectName, v.title);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
      {/* sector pill + title */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-white/60">
          <Lock className="h-3 w-3" /> VAULT SECTOR: {stats.sector}
        </div>
        <h1 className="mt-2 text-center text-4xl font-bold">
          {head && <span>{head} </span>}
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            {tail}
          </span>
        </h1>
        <p className="mt-1 max-w-md text-center text-sm text-white/50">
          {v.description ?? "Master the fundamentals, strengthen your concepts and track your progress."}
        </p>
      </div>

      {/* main 3-col layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* left column */}
        <div className="col-span-12 space-y-3 lg:col-span-3">
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-4">
            <p className="text-xs font-medium uppercase tracking-widest text-white/40">Current Phase</p>
            <p className="mt-1 text-lg font-bold">{stats.phase}</p>
            <div className="mt-2 flex items-center gap-2 text-sm text-white/60">
              <Zap className="h-4 w-4 text-violet-400" /> {stats.state}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-xs font-medium uppercase tracking-widest text-white/40">Completion</p>
            <p className="mt-1 text-2xl font-bold">{stats.completion}%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400" style={{ width: `${stats.completion}%` }} />
            </div>
          </div>
        </div>

        {/* center radar */}
        <div className="col-span-12 lg:col-span-6">
          <div className="mx-auto aspect-[480/440] w-full max-w-[400px]">
            <RadarChart axes={stats.radarAxes} />
          </div>
        </div>

        {/* right column */}
        <div className="col-span-12 space-y-3 lg:col-span-3">
          <Link
            href={vaultHref}
            className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3.5 font-semibold shadow-lg shadow-violet-900/40 transition hover:opacity-90"
          >
            <span className="flex items-center gap-2">
              Continue Learning <Rocket className="h-4 w-4" />
            </span>
            <ChevronRight className="h-5 w-5" />
          </Link>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-white/40">
              Vault Summary
            </p>
            <SummaryRow icon={FileStack} label="Modules" value={String(stats.modules)} />
            <SummaryRow icon={FileText} label="Resources" value={String(v.resourceCount)} />
            <SummaryRow icon={Gauge} label="Avg. Score" value={`${stats.avgScore}%`} />
            <SummaryRow icon={Timer} label="Study Time" value={stats.studyTime} />
          </div>
        </div>
      </div>

      {/* vault tabs (real vaults) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {vaults.map((vault, i) => (
          <button
            key={vault.vaultId}
            onClick={() => setActive(i)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition ${
              i === active
                ? "border-violet-500/60 bg-violet-500/15 text-white shadow-[0_0_20px_-4px_#7c3aed]"
                : "border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/5"
            }`}
          >
            {vault.subjectName ?? vault.title}
          </button>
        ))}

        <CreateVaultGlobalDialog
          squads={squads}
          trigger={
            <button className="shrink-0 whitespace-nowrap rounded-full border border-dashed border-white/10 hover:border-violet-500/50 bg-white/[0.02] hover:bg-white/[0.04] px-4 py-1.5 text-sm text-zinc-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer">
              <Plus className="w-3.5 h-3.5 text-violet-400" /> Add Vault
            </button>
          }
        />
      </div>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="flex items-center gap-2 text-sm text-white/60">
        <Icon className="h-4 w-4 text-violet-400" /> {label}
      </span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
