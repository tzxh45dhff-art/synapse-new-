"use client";

import { use, useEffect, useState, useCallback } from "react";
import { UploadDropzone } from "@/components/resources/upload-dropzone";
import { ResourceCard } from "@/components/resources/resource-card";
import { VaultHeader } from "@/components/vaults/vault-header";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteResource } from "@/app/actions/resources/delete-resource";
import { retryProcessing } from "@/app/actions/resources/retry-processing";
import { getVault } from "@/app/actions/vaults/queries";
import { listResources } from "@/app/actions/resources/queries";
import type { VaultDetail, ResourceListItem } from "@/types/vault";

interface Props {
  params: Promise<{ id: string; vaultId: string }>;
}

export default function ResourcesPage({ params }: Props) {
  const { id: squadId, vaultId } = use(params);

  const [vault, setVault] = useState<VaultDetail | null>(null);
  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [v, r] = await Promise.all([
        getVault(vaultId),
        listResources(vaultId),
      ]);
      setVault(v);
      setResources(r);
    } finally {
      setLoading(false);
    }
  }, [vaultId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete(resourceId: string) {
    await deleteResource(resourceId, squadId, vaultId);
    setResources((r) => r.filter((x) => x.id !== resourceId));
  }

  async function handleRetry(resourceId: string) {
    await retryProcessing(resourceId, squadId, vaultId);
    fetchData();
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!vault) return null;

  return (
    <div className="space-y-8">
      <VaultHeader vault={vault} squadId={squadId} />

      {/* Upload zone */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Upload</h2>
        <UploadDropzone
          vaultId={vaultId}
          squadId={squadId}
          onUploadComplete={fetchData}
        />
      </section>

      {/* Resource library */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Resources · {resources.length}
          </h2>
        </div>

        {resources.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            No resources yet. Upload your first file above.
          </div>
        ) : (
          <div className="space-y-2">
            {resources.map((r, i) => (
              <ResourceCard
                key={r.id}
                resource={r}
                index={i}
                onDelete={handleDelete}
                onRetry={handleRetry}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
