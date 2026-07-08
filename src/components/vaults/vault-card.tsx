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

export function VaultCard({ vault, squadId, index = 0 }: VaultCardProps) {
  const gradient = vault.color
    ? undefined
    : GRADIENT_PRESETS[index % GRADIENT_PRESETS.length];

  const stats = vault.statistics;
  const accentStyle = vault.color
    ? { background: `linear-gradient(135deg, ${vault.color}33, ${vault.color}11)` }
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
    >
      <Link href={`/dashboard/squads/${squadId}/vaults/${vault.id}`}>
        <div
          className={`relative group rounded-2xl border border-white/[0.06] bg-white/[0.03]
            hover:border-white/[0.12] hover:bg-white/[0.06] transition-all duration-200
            overflow-hidden cursor-pointer`}
        >
          {/* Accent gradient banner */}
          <div
            className={`h-1.5 w-full ${gradient ? `bg-gradient-to-r ${gradient}` : ""}`}
            style={vault.color ? { background: vault.color } : undefined}
          />

          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl
                  border border-white/[0.08] shrink-0
                  ${gradient ? `bg-gradient-to-br ${gradient}` : "bg-white/[0.06]"}`}
                style={accentStyle}
              >
                {vault.icon ?? "📚"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white truncate text-[15px] leading-tight">
                    {vault.title}
                  </h3>
                  {vault.is_archived && (
                    <Archive className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  )}
                </div>
                {vault.subject && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {vault.subject.icon} {vault.subject.name}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            {vault.description && (
              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                {vault.description}
              </p>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <FileText className="w-3.5 h-3.5" />
                <span>{stats?.resource_count ?? 0} resources</span>
              </div>
              {stats && stats.storage_bytes > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>{formatBytes(stats.storage_bytes)}</span>
                </div>
              )}
              <div className="ml-auto text-xs text-zinc-600">
                {formatDistanceToNow(new Date(vault.updated_at), { addSuffix: true })}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
