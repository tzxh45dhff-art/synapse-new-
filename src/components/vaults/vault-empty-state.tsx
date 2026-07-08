"use client";

import { motion } from "framer-motion";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VaultEmptyStateProps {
  showArchived?: boolean;
  onCreateClick?: () => void;
}

export function VaultEmptyState({ showArchived, onCreateClick }: VaultEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600/20 to-purple-600/10
        border border-white/[0.08] flex items-center justify-center mb-6">
        <BookOpen className="w-9 h-9 text-violet-400" />
      </div>

      <h3 className="text-xl font-semibold text-white mb-2">
        {showArchived ? "No archived vaults" : "No vaults yet"}
      </h3>
      <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
        {showArchived
          ? "Archived vaults will appear here. You can restore them at any time."
          : "Create your first vault to start organizing study material for a subject."}
      </p>

      {!showArchived && onCreateClick && (
        <Button
          onClick={onCreateClick}
          className="mt-8 gap-2 bg-violet-600 hover:bg-violet-500 text-white"
        >
          <Plus className="w-4 h-4" />
          Create Vault
        </Button>
      )}
    </motion.div>
  );
}
