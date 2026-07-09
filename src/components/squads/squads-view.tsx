"use client";

import Link from "next/link";
import { ShieldPlus, UserPlus, Users, Plus, LogIn } from "lucide-react";
import { CreateSquadDialog } from "@/components/squads/create-squad-dialog";
import { JoinSquadDialog } from "@/components/squads/join-squad-dialog";
import { SquadAvatar } from "@/components/squads/squad-avatar";
import type { SquadListItem } from "@/types/squad";

interface SquadsViewProps {
  squads: SquadListItem[];
}

export function SquadsView({ squads }: SquadsViewProps) {
  const isEmpty = squads.length === 0;

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-[1500px]">
        {/* hero */}
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-4xl font-bold text-transparent">
            Collaborative Hub
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/50">
            Learning is a team sport. Join forces with elite students or establish your own
            tactical squad to dominate complex missions.
          </p>
        </div>

        {/* create / join cards */}
        <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-7 text-center backdrop-blur-sm transition hover:border-violet-500/40">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15">
              <ShieldPlus className="h-7 w-7 text-violet-400" />
            </div>
            <h2 className="text-xl font-bold">Create a Squad</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm text-white/50">
              Start a new mission group. Invite peers, set learning objectives, and build your
              collective knowledge base.
            </p>
            <div className="mt-6">
              <CreateSquadDialog>
                <button className="w-full rounded-xl bg-gradient-to-r from-violet-400 to-violet-300 px-6 py-3 text-sm font-semibold text-violet-950 transition hover:opacity-90">
                  Initialize Squad
                </button>
              </CreateSquadDialog>
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-7 text-center backdrop-blur-sm transition hover:border-cyan-500/40">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15">
              <UserPlus className="h-7 w-7 text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold">Join a Squad</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm text-white/50">
              Enter a squad ID or browse public learning pods to sync your progress with other
              high-performers.
            </p>
            <div className="mt-6">
              <JoinSquadDialog>
                <button className="w-full rounded-xl border border-cyan-500/50 px-6 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10">
                  Scan for Squads
                </button>
              </JoinSquadDialog>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-3xl font-bold text-transparent">
            Collaborative Hub
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {squads.length} squad{squads.length !== 1 ? "s" : ""} · learning is a team sport.
          </p>
        </div>
        <div className="flex gap-3">
          <JoinSquadDialog>
            <button className="flex items-center gap-2 rounded-xl border border-cyan-500/50 px-4 py-2.5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10">
              <LogIn className="h-4 w-4" /> Join Squad
            </button>
          </JoinSquadDialog>
          <CreateSquadDialog>
            <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-400 to-violet-300 px-4 py-2.5 text-sm font-semibold text-violet-950 transition hover:opacity-90">
              <Plus className="h-4 w-4" /> New Squad
            </button>
          </CreateSquadDialog>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {squads.map((squad) => {
          const role = squad.current_user_role ?? "member";
          return (
            <Link
              key={squad.id}
              href={`/dashboard/squads/${squad.id}`}
              className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-violet-500/40 hover:bg-white/[0.05]"
            >
              <div className="flex items-start gap-4">
                <SquadAvatar name={squad.name} avatarUrl={squad.avatar_url} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-base font-semibold">{squad.name}</h4>
                    <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium capitalize text-violet-300">
                      {role}
                    </span>
                  </div>
                  {squad.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-white/50">{squad.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-white/40">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      {squad.member_count} member{squad.member_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
