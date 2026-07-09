"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api-client";
import { VaultHeader } from "@/components/vaults/vault-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { updateVault } from "@/app/actions/vaults/update-vault";
import { archiveVault } from "@/app/actions/vaults/archive-vault";
import { restoreVault } from "@/app/actions/vaults/restore-vault";
import { deleteVault } from "@/app/actions/vaults/delete-vault";
import type { VaultDetail } from "@/types/vault";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";

interface Props {
  params: { id: string; vaultId: string };
}

export default function VaultSettingsPage({ params }: Props) {
  const { id: squadId, vaultId } = params;
  const router = useRouter();

  const [vault, setVault] = useState<VaultDetail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    api.get<VaultDetail>(`/vaults/${vaultId}`).then((v) => {
      setVault(v);
      setTitle(v.title);
      setDescription(v.description ?? "");
      setLoading(false);
    });
  }, [vaultId]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    startTransition(async () => {
      try {
        const updated = await updateVault(vaultId, squadId, {
          title: title.trim(),
          description: description.trim() || undefined,
        });
        setVault(updated);
      } catch (err: any) {
        setSaveError(err?.message ?? "Failed to save.");
      }
    });
  }

  async function handleArchiveToggle() {
    if (!vault) return;
    const updated = vault.is_archived
      ? await restoreVault(vaultId, squadId)
      : await archiveVault(vaultId, squadId);
    setVault(updated);
  }

  async function handleDelete() {
    if (deleteConfirm !== vault?.title) return;
    await deleteVault(vaultId, squadId);
    router.push(`/dashboard/squads/${squadId}/vaults`);
  }

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
  if (!vault) return null;

  return (
    <div className="space-y-10">
      <VaultHeader vault={vault} squadId={squadId} />

      {/* General settings */}
      <section className="space-y-5 p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <h2 className="text-base font-semibold text-white">General</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="settings-title" className="text-xs text-zinc-400">Title</Label>
            <Input id="settings-title" value={title} onChange={(e) => setTitle(e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-white" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-desc" className="text-xs text-zinc-400">Description</Label>
            <Textarea id="settings-desc" value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3} className="bg-white/[0.04] border-white/[0.08] text-white resize-none" />
          </div>
          {saveError && <p className="text-xs text-red-400">{saveError}</p>}
          <Button type="submit" disabled={isPending}
            className="bg-violet-600 hover:bg-violet-500 text-white gap-2">
            {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save Changes"}
          </Button>
        </form>
      </section>

      {/* Danger zone */}
      <section className="space-y-4 p-6 rounded-2xl border border-red-900/30 bg-red-950/10">
        <h2 className="text-base font-semibold text-red-400">Danger Zone</h2>

        {/* Archive / Restore */}
        <div className="flex items-center justify-between py-3 border-b border-white/[0.04]">
          <div>
            <p className="text-sm font-medium text-white">
              {vault.is_archived ? "Restore vault" : "Archive vault"}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {vault.is_archived
                ? "Restore this vault to make it visible again."
                : "Hide this vault from the default list. Resources are preserved."}
            </p>
          </div>
          <Button onClick={handleArchiveToggle} variant="outline"
            className="gap-2 border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] shrink-0">
            {vault.is_archived
              ? <><ArchiveRestore className="w-4 h-4" /> Restore</>
              : <><Archive className="w-4 h-4" /> Archive</>}
          </Button>
        </div>

        {/* Delete */}
        <div className="space-y-3 pt-1">
          <div>
            <p className="text-sm font-medium text-white">Delete vault</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Permanently deletes this vault and all its resources. This cannot be undone.
            </p>
          </div>
          <p className="text-xs text-zinc-400">
            Type <strong className="text-white">{vault.title}</strong> to confirm:
          </p>
          <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={vault.title}
            className="bg-white/[0.04] border-red-900/30 text-white max-w-xs" />
          <Button onClick={handleDelete}
            disabled={deleteConfirm !== vault.title}
            className="gap-2 bg-red-600 hover:bg-red-500 text-white disabled:opacity-30">
            <Trash2 className="w-4 h-4" /> Delete Vault
          </Button>
        </div>
      </section>
    </div>
  );
}
