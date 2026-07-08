"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudUpload, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateUploadUrl } from "@/app/actions/resources/generate-upload-url";
import { completeUpload } from "@/app/actions/resources/complete-upload";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, type UploadItem, type UploadPhase } from "@/types/vault";
import { STAGE_LABELS } from "@/types/vault";
import { v4 as uuidv4 } from "uuid";

interface UploadDropzoneProps {
  vaultId: string;
  squadId: string;
  onUploadComplete?: () => void;
}

export function UploadDropzone({ vaultId, squadId, onUploadComplete }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function updateUpload(id: string, patch: Partial<UploadItem>) {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  function validateFile(file: File): string | null {
    if (!ALLOWED_MIME_TYPES[file.type]) return `Unsupported type: ${file.type}`;
    if (file.size > MAX_UPLOAD_BYTES) return `File exceeds 50 MB limit`;
    return null;
  }

  async function uploadFile(item: UploadItem) {
    const { file } = item;

    try {
      // 1. Request signed URL
      updateUpload(item.id, { phase: "requesting_url" });
      const urlResp = await generateUploadUrl(vaultId, file.name, file.type, file.size);

      // 2. Upload directly to Supabase Storage
      updateUpload(item.id, { phase: "uploading", resource_id: urlResp.resource_id });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            updateUpload(item.id, { progress: Math.round((e.loaded / e.total) * 100) });
          }
        });
        xhr.addEventListener("load", () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))));
        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.open("PUT", urlResp.upload_url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      // 3. Notify backend
      updateUpload(item.id, { phase: "notifying", progress: 100 });
      await completeUpload(vaultId, urlResp.resource_id, urlResp.storage_path, squadId);

      updateUpload(item.id, { phase: "processing" });
      onUploadComplete?.();

      // Poll status briefly to show stage updates
      await pollStatus(item.id, urlResp.resource_id);
    } catch (err: any) {
      updateUpload(item.id, { phase: "error", error: err?.message ?? "Upload failed" });
    }
  }

  async function pollStatus(uploadId: string, resourceId: string) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`/api/resources/${resourceId}/status`);
        if (!res.ok) break;
        const data = await res.json();
        updateUpload(uploadId, { processing_stage: data.processing_stage });
        if (["complete", "failed", "cancelled"].includes(data.processing_stage)) {
          updateUpload(uploadId, { phase: data.processing_stage === "complete" ? "complete" : "error" });
          return;
        }
      } catch {
        break;
      }
    }
  }

  function handleFiles(files: FileList | File[]) {
    const newItems: UploadItem[] = [];
    for (const file of Array.from(files)) {
      const error = validateFile(file);
      newItems.push({
        id: uuidv4(),
        file,
        phase: error ? "error" : "idle",
        progress: 0,
        error: error ?? undefined,
      });
    }
    setUploads((prev) => [...prev, ...newItems]);
    // Start valid uploads
    newItems.filter((i) => !i.error).forEach(uploadFile);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [vaultId, squadId]);

  const phaseLabel: Record<UploadPhase, string> = {
    idle: "Queued",
    requesting_url: "Preparing…",
    uploading: "Uploading",
    notifying: "Saving…",
    processing: "Processing",
    complete: "Ready",
    error: "Failed",
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <motion.div
        animate={{ borderColor: isDragging ? "#8B5CF6" : "rgba(255,255,255,0.06)" }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="relative flex flex-col items-center justify-center gap-3 p-10 rounded-2xl
          border-2 border-dashed cursor-pointer transition-all duration-200
          bg-white/[0.02] hover:bg-white/[0.04]"
        style={{ borderColor: isDragging ? "#8B5CF6" : "rgba(255,255,255,0.06)" }}
      >
        <input ref={inputRef} type="file" multiple className="hidden"
          accept={Object.keys(ALLOWED_MIME_TYPES).join(",")}
          onChange={(e) => e.target.files && handleFiles(e.target.files)} />

        <motion.div animate={{ scale: isDragging ? 1.1 : 1 }} transition={{ duration: 0.15 }}>
          <CloudUpload className={`w-10 h-10 ${isDragging ? "text-violet-400" : "text-zinc-600"}`} />
        </motion.div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-300">
            {isDragging ? "Drop files here" : "Drop files or click to browse"}
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            PDF, DOCX, PPTX, TXT, MD, Images · Max 50 MB each
          </p>
        </div>
      </motion.div>

      {/* Upload progress list */}
      <AnimatePresence>
        {uploads.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {uploads.map((item) => (
              <motion.div key={item.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
              >
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  <div className="shrink-0">
                    {item.phase === "complete" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {item.phase === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}
                    {!["complete", "error"].includes(item.phase) && (
                      <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{item.file.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {item.phase === "uploading"
                        ? `Uploading ${item.progress}%`
                        : item.phase === "processing" && item.processing_stage
                          ? STAGE_LABELS[item.processing_stage]
                          : phaseLabel[item.phase]}
                      {item.error && ` — ${item.error}`}
                    </p>
                  </div>

                  {/* Remove */}
                  {(item.phase === "complete" || item.phase === "error") && (
                    <Button variant="ghost" size="icon"
                      className="w-6 h-6 text-zinc-600 hover:text-white shrink-0"
                      onClick={() => setUploads((p) => p.filter((u) => u.id !== item.id))}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                {/* Progress bar */}
                {item.phase === "uploading" && (
                  <div className="mt-2.5 h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-violet-500 rounded-full"
                      animate={{ width: `${item.progress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
