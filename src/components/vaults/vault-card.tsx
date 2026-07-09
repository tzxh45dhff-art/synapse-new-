"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Archive, FileText, HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VaultListItem } from "@/types/vault";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface VaultCardProps {
  vault: VaultListItem;
  squadId: string;
  index?: number;
}

const GRADIENT_PRESETS = [
  "from-violet-600/20 to-purple-600/10",
  "from-blue-600/20 to-cyan-600/10",
  "from-emerald-600/20 to-teal-600/10",
  "from-orange-600/20 to-amber-600/10",
  "from-rose-600/20 to-pink-600/10",
  "from-indigo-600/20 to-blue-600/10",
];

const SHADOW_PRESETS = [
  "shadow-[0_0_30px_-15px_rgba(167,139,250,0.15)] hover:shadow-[0_0_30px_-5px_rgba(167,139,250,0.25)] hover:border-purple-500/30",
  "shadow-[0_0_30px_-15px_rgba(56,189,248,0.15)] hover:shadow-[0_0_30px_-5px_rgba(56,189,248,0.25)] hover:border-sky-500/30",
  "shadow-[0_0_30px_-15px_rgba(52,211,153,0.15)] hover:shadow-[0_0_30px_-5px_rgba(52,211,153,0.25)] hover:border-emerald-500/30",
  "shadow-[0_0_30px_-15px_rgba(251,146,60,0.15)] hover:shadow-[0_0_30px_-5px_rgba(251,146,60,0.25)] hover:border-orange-500/30",
  "shadow-[0_0_30px_-15px_rgba(251,113,133,0.15)] hover:shadow-[0_0_30px_-5px_rgba(251,113,133,0.25)] hover:border-rose-500/30",
  "shadow-[0_0_30px_-15px_rgba(129,140,248,0.15)] hover:shadow-[0_0_30px_-5px_rgba(129,140,248,0.25)] hover:border-indigo-500/30",
];

export function VaultCard({ vault, squadId, index = 0 }: VaultCardProps) {
  const gradient = vault.color
    ? undefined
    : GRADIENT_PRESETS[index % GRADIENT_PRESETS.length];

  const stats = vault.statistics;
  const accentStyle = vault.color
    ? { background: `linear-gradient(135deg, ${vault.color}33, ${vault.color}11)` }
    : undefined;

  const shadowPreset = vault.color
    ? ""
    : SHADOW_PRESETS[index % SHADOW_PRESETS.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: "easeOut" } }}
    >
      <Link href={`/dashboard/squads/${squadId}/vaults/${vault.id}`}>
        <div
          className={`relative group rounded-2xl border border-white/[0.06] bg-zinc-950/20 backdrop-blur-md
            hover:border-white/[0.15] hover:bg-zinc-900/40 transition-all duration-300
            overflow-hidden cursor-pointer ${shadowPreset}`}
          style={vault.color ? {
            boxShadow: `0 0 30px -15px ${vault.color}33`,
          } : undefined}
        >
          {/* Ambient background glow inside the card */}
          {gradient ? (
            <div className={`absolute -right-12 -top-12 w-28 h-28 rounded-full blur-[40px] opacity-10 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none bg-gradient-to-br ${gradient}`} />
          ) : (
            <div 
              className="absolute -right-12 -top-12 w-28 h-28 rounded-full blur-[40px] opacity-10 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none"
              style={vault.color ? { backgroundColor: `${vault.color}22` } : undefined}
            />
          )}

          {/* Accent neon top border */}
          <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden">
            <div 
              className={`h-full w-full opacity-60 group-hover:opacity-100 transition-opacity duration-300
                ${gradient ? `bg-gradient-to-r ${gradient}` : ""}`}
              style={vault.color ? { backgroundColor: vault.color } : undefined}
            />
          </div>

          <div className="p-5 space-y-4 relative z-10">
            {/* Header */}
            <div className="flex items-start gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
                  border border-white/[0.08] shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-300
                  ${gradient ? `bg-gradient-to-br ${gradient}` : "bg-white/[0.04]"}`}
                style={accentStyle}
              >
                {vault.icon ?? "📚"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white truncate text-[15px] leading-tight group-hover:text-white transition-colors">
                    {vault.title}
                  </h3>
                  {vault.is_archived && (
                    <Archive className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  )}
                </div>
                {vault.subject && (
                  <p className="text-xs text-zinc-500 mt-0.5 group-hover:text-zinc-400 transition-colors">
                    {vault.subject.icon} {vault.subject.name}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            {vault.description && (
              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed min-h-[36px]">
                {vault.description}
              </p>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 pt-3 border-t border-white/[0.04] group-hover:border-white/[0.08] transition-colors duration-300">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                <FileText className="w-3.5 h-3.5 text-zinc-600 group-hover:text-violet-400 transition-colors" />
                <span>{stats?.resource_count ?? 0} files</span>
              </div>
              {stats && stats.storage_bytes > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  <HardDrive className="w-3.5 h-3.5 text-zinc-600 group-hover:text-violet-400 transition-colors" />
                  <span>{formatBytes(stats.storage_bytes)}</span>
                </div>
              )}
              <div className="ml-auto text-xs text-zinc-600 group-hover:text-zinc-500 transition-colors">
                {formatDistanceToNow(new Date(vault.updated_at), { addSuffix: true })}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
