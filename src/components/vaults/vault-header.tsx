"use client";

import { motion } from "framer-motion";
import { Archive, ChevronLeft, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { VaultDetail } from "@/types/vault";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface VaultHeaderProps {
  vault: VaultDetail;
  squadId: string;
}

export function VaultHeader({ vault, squadId }: VaultHeaderProps) {
  const stats = vault.statistics;
  const pathname = usePathname();

  const isCodingSubject =
    vault.subject?.icon === "💻" ||
    vault.subject?.name?.toLowerCase().includes("coding") ||
    vault.subject?.name?.toLowerCase().includes("programming") ||
    vault.subject?.name?.toLowerCase().includes("dsa") ||
    vault.subject?.name?.toLowerCase().includes("leetcode");

  const tabs = [
    { label: "Resources", seg: "resources" },
    { label: "Notes", seg: "notes" },
    { label: "MCQ Practice", seg: "mcq" },
    ...(isCodingSubject ? [{ label: "Coding Questions", seg: "coding" }] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Back nav */}
      <div className="mb-6">
        <Link
          href={`/dashboard/squads/${squadId}/vaults`}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Vaults
        </Link>
      </div>

      {/* Main header */}
      <div className="flex items-start gap-5">
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl border border-white/[0.08] flex items-center
            justify-center text-3xl shrink-0"
          style={vault.color ? { background: `${vault.color}22` } : undefined}
        >
          {vault.icon ?? "📚"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white tracking-tight truncate">
              {vault.title}
            </h1>
            {vault.is_archived && (
              <Badge variant="secondary" className="gap-1 text-zinc-400 bg-white/[0.06]">
                <Archive className="w-3 h-3" /> Archived
              </Badge>
            )}
          </div>

          {vault.subject && (
            <p className="text-sm text-zinc-400 mt-1">
              {vault.subject.icon} {vault.subject.name}
            </p>
          )}

          {vault.description && (
            <p className="text-sm text-zinc-500 mt-2 max-w-2xl leading-relaxed">
              {vault.description}
            </p>
          )}
        </div>

        {/* Settings button */}
        <Link href={`/dashboard/squads/${squadId}/vaults/${vault.id}/settings`}>
          <Button variant="ghost" size="icon"
            className="text-zinc-500 hover:text-white hover:bg-white/[0.06] shrink-0">
            <Settings className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* Section nav */}
      <div className="mt-6 flex items-center gap-1">
        {tabs.map((s) => {
          const href = `/dashboard/squads/${squadId}/vaults/${vault.id}/${s.seg}`;
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={s.seg}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all
                ${isActive
                  ? "bg-violet-600/10 border border-violet-500/20 text-violet-400"
                  : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-white/[0.06]">
          {[
            { label: "Resources", value: stats.resource_count },
            { label: "PDFs", value: stats.pdf_count },
            { label: "PPTs", value: stats.ppt_count },
            { label: "Storage", value: formatBytes(stats.storage_bytes) },
            { label: "Contributors", value: stats.contributor_count },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
              <p className="text-lg font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
