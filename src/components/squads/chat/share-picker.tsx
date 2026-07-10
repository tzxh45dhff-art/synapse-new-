"use client";

import { useEffect, useState } from "react";
import { FileText, StickyNote, Loader2, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listVaults } from "@/app/actions/vaults/queries";
import { listResources } from "@/app/actions/resources/queries";
import { listNotes } from "@/app/actions/notes/queries";
import type { VaultListItem, ResourceListItem } from "@/types/vault";
import type { NoteListItem } from "@/types/notes";
import type { SharedAttachment, SquadMessageType } from "@/types/squad-chat";

interface Props {
  squadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: (type: Extract<SquadMessageType, "resource" | "note">, shared: SharedAttachment) => void;
}

export function SharePicker({ squadId, open, onOpenChange, onShare }: Props) {
  const [vaults, setVaults] = useState<VaultListItem[]>([]);
  const [vault, setVault] = useState<VaultListItem | null>(null);
  const [contents, setContents] = useState<{
    vaultId: string;
    resources: ResourceListItem[];
    notes: NoteListItem[];
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    listVaults(squadId)
      .then((v) => active && setVaults(v))
      .catch(() => active && setVaults([]));
    return () => {
      active = false;
    };
  }, [open, squadId]);

  useEffect(() => {
    if (!vault) return;
    let active = true;
    Promise.all([listResources(vault.id), listNotes(vault.id)])
      .then(([r, n]) => active && setContents({ vaultId: vault.id, resources: r, notes: n }))
      .catch(() => active && setContents({ vaultId: vault.id, resources: [], notes: [] }));
    return () => {
      active = false;
    };
  }, [vault]);

  const loaded = vault !== null && contents?.vaultId === vault.id;
  const loading = vault !== null && !loaded;
  const resources = loaded ? contents!.resources : [];
  const notes = loaded ? contents!.notes : [];

  function handleOpenChange(next: boolean) {
    if (next) setVault(null); // reset to vault list each time it opens
    onOpenChange(next);
  }

  function share(
    type: "resource" | "note",
    ref_id: string,
    title: string,
    subtitle: string | null,
  ) {
    if (!vault) return;
    onShare(type, { ref_id, vault_id: vault.id, title, subtitle });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{vault ? vault.title : "Share from a vault"}</DialogTitle>
        </DialogHeader>

        {!vault ? (
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {vaults.length === 0 && (
              <p className="py-6 text-center text-sm text-white/40">No vaults in this squad yet.</p>
            )}
            {vaults.map((v) => (
              <button
                key={v.id}
                onClick={() => setVault(v)}
                className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/[0.06]"
              >
                <span className="truncate">{v.title}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
              </button>
            ))}
          </div>
        ) : loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-white/40" />
          </div>
        ) : (
          <Tabs defaultValue="resources">
            <TabsList className="w-full">
              <TabsTrigger value="resources" className="flex-1">
                Resources ({resources.length})
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex-1">
                Notes ({notes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resources" className="max-h-72 space-y-1 overflow-y-auto">
              {resources.length === 0 && (
                <p className="py-6 text-center text-sm text-white/40">No resources.</p>
              )}
              {resources.map((r) => (
                <PickRow
                  key={r.id}
                  icon={<FileText className="h-4 w-4 text-violet-300" />}
                  title={r.title || r.file_name}
                  subtitle={r.file_type?.toUpperCase()}
                  onClick={() => share("resource", r.id, r.title || r.file_name, r.file_type)}
                />
              ))}
            </TabsContent>

            <TabsContent value="notes" className="max-h-72 space-y-1 overflow-y-auto">
              {notes.length === 0 && (
                <p className="py-6 text-center text-sm text-white/40">No notes.</p>
              )}
              {notes.map((n) => (
                <PickRow
                  key={n.id}
                  icon={<StickyNote className="h-4 w-4 text-sky-300" />}
                  title={n.title}
                  subtitle={`${n.word_count} words`}
                  onClick={() => share("note", n.id, n.title, `${n.word_count} words`)}
                />
              ))}
            </TabsContent>
          </Tabs>
        )}

        {vault && (
          <button
            onClick={() => setVault(null)}
            className="mt-1 text-xs text-white/40 hover:text-white/70"
          >
            ← Back to vaults
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PickRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{title}</p>
        {subtitle && <p className="truncate text-[10px] uppercase tracking-wide text-white/40">{subtitle}</p>}
      </div>
    </button>
  );
}
