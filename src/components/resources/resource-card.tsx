"use client";

import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  FileText, FileImage, Presentation, File,
  MoreHorizontal, Download, Pencil, Trash2, RotateCcw, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProcessingBadge } from "./processing-badge";
import type { ResourceListItem } from "@/types/vault";
import { getResourceDownloadUrl } from "@/app/actions/resources/queries";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function FileIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t === "pdf") return <FileText className="w-5 h-5 text-red-400" />;
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(t))
    return <FileImage className="w-5 h-5 text-blue-400" />;
  if (["ppt", "pptx"].includes(t)) return <Presentation className="w-5 h-5 text-orange-400" />;
  if (["doc", "docx"].includes(t)) return <FileText className="w-5 h-5 text-sky-400" />;
  return <File className="w-5 h-5 text-zinc-400" />;
}

interface ResourceCardProps {
  resource: ResourceListItem;
  index?: number;
  onRename?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  onClick?: (id: string) => void;
}

export function ResourceCard({
  resource, index = 0, onRename, onDelete, onRetry, onCancel, onClick,
}: ResourceCardProps) {
  const uploader = resource.uploader;
  const uploaderName = uploader?.display_name ?? uploader?.full_name ?? "Unknown";
  const isProcessing = !["complete", "failed", "cancelled"].includes(resource.processing_stage);

  async function handleOpenResource() {
    if (onClick) {
      onClick(resource.id);
      return;
    }
    if (resource.processing_stage !== "complete") {
      toast.error(`File is still processing (${resource.processing_stage}). Please wait.`);
      return;
    }
    try {
      const { download_url } = await getResourceDownloadUrl(resource.id);
      window.open(download_url, "_blank");
    } catch {
      toast.error("Failed to open file.");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="group flex items-center gap-4 px-4 py-3.5 rounded-xl
        border border-white/[0.05] bg-white/[0.02]
        hover:border-white/[0.1] hover:bg-white/[0.04] transition-all duration-150 cursor-pointer"
      onClick={handleOpenResource}
    >
      {/* File icon */}
      <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/[0.06]
        flex items-center justify-center shrink-0">
        <FileIcon type={resource.file_type} />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{resource.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-zinc-500">{resource.file_name}</span>
          <span className="text-zinc-700">·</span>
          <span className="text-xs text-zinc-500">{formatBytes(resource.file_size_bytes)}</span>
        </div>
      </div>

      {/* Badge */}
      <ProcessingBadge stage={resource.processing_stage} />

      {/* Uploader */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <Avatar className="w-5 h-5">
          <AvatarImage src={uploader?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[9px] bg-zinc-800 text-zinc-400">
            {uploaderName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs text-zinc-500 max-w-[80px] truncate">{uploaderName}</span>
      </div>

      {/* Time */}
      <span className="hidden md:block text-xs text-zinc-600 shrink-0">
        {formatDistanceToNow(new Date(resource.created_at), { addSuffix: true })}
      </span>

      {/* Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon"
            className="w-7 h-7 text-zinc-600 hover:text-white hover:bg-white/[0.08]
              opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-zinc-900 border-white/[0.08] text-white w-44">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename?.(resource.id); }}
            className="gap-2 cursor-pointer hover:bg-white/[0.06]">
            <Pencil className="w-3.5 h-3.5" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenResource(); }}
            className="gap-2 cursor-pointer hover:bg-white/[0.06]">
            <Download className="w-3.5 h-3.5" /> Download / Open
          </DropdownMenuItem>

          {resource.processing_stage === "failed" && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRetry?.(resource.id); }}
              className="gap-2 cursor-pointer hover:bg-white/[0.06] text-amber-400">
              <RotateCcw className="w-3.5 h-3.5" /> Retry
            </DropdownMenuItem>
          )}
          {isProcessing && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCancel?.(resource.id); }}
              className="gap-2 cursor-pointer hover:bg-white/[0.06] text-zinc-400">
              <X className="w-3.5 h-3.5" /> Cancel
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete?.(resource.id); }}
            className="gap-2 cursor-pointer hover:bg-red-950/40 text-red-400">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}
