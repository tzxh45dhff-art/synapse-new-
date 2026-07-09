"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Code2, Loader2, Plus, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createVault } from "@/app/actions/vaults/create-vault";

const ACCENT_COLORS = [
  "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B",
  "#EF4444", "#EC4899", "#06B6D4", "#84CC16",
];

const VAULT_ICONS = ["📚", "🧠", "💡", "🔬", "📐", "🌐", "⚡", "🎯", "🔮", "🛠️", "📊", "🏗️"];

interface CreateVaultDialogProps {
  squadId: string;
  trigger?: React.ReactNode;
}

export function CreateVaultDialog({ squadId, trigger }: CreateVaultDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [isCoding, setIsCoding] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(ACCENT_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState("📚");
  const [iconOpen, setIconOpen] = useState(false);

  function reset() {
    setTitle("");
    setSubjectName("");
    setIsCoding(false);
    setDescription("");
    setSelectedColor(ACCENT_COLORS[0]);
    setSelectedIcon("📚");
    setError(null);
    setIconOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (!subjectName.trim()) { setError("Subject is required."); return; }

    startTransition(async () => {
      try {
        const vault = await createVault(squadId, {
          title: title.trim(),
          subject_name: subjectName.trim(),
          is_coding: isCoding,
          description: description.trim() || undefined,
          color: selectedColor,
          icon: selectedIcon,
        });
        setOpen(false);
        reset();
        router.push(`/dashboard/squads/${squadId}/vaults/${vault.id}`);
      } catch (err: any) {
        setError(err?.message ?? "Failed to create vault.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2 bg-violet-600 hover:bg-violet-500 text-white">
            <Plus className="w-4 h-4" /> New Vault
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md bg-zinc-950 border-white/[0.08] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            Create Vault
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Icon + Color row */}
          <div className="flex gap-4">
            {/* Icon picker */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Icon</Label>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIconOpen(!iconOpen)}
                  className="w-14 h-10 text-xl border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08]"
                >
                  {selectedIcon}
                </Button>
                {iconOpen && (
                  <div className="absolute top-12 left-0 z-50 w-52 p-2 bg-zinc-900 border border-white/[0.08] rounded-xl shadow-xl">
                    <div className="grid grid-cols-6 gap-1">
                      {VAULT_ICONS.map((icon) => (
                        <button key={icon} type="button"
                          onClick={() => { setSelectedIcon(icon); setIconOpen(false); }}
                          className={`text-xl p-1.5 rounded-md hover:bg-white/[0.08] transition-colors
                            ${selectedIcon === icon ? "bg-white/[0.12] ring-1 ring-violet-500/50" : ""}`}>
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Color picker */}
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-zinc-400">Accent Color</Label>
              <div className="flex flex-wrap gap-2">
                {ACCENT_COLORS.map((color) => (
                  <button key={color} type="button"
                    onClick={() => setSelectedColor(color)}
                    className="w-7 h-7 rounded-full transition-all hover:scale-110"
                    style={{ backgroundColor: color }}>
                    {selectedColor === color && (
                      <Check className="w-3.5 h-3.5 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="cv-title" className="text-xs text-zinc-400">Title *</Label>
            <Input
              id="cv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Operating Systems"
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600"
            />
          </div>

          {/* Subject + is_coding */}
          <div className="space-y-1.5">
            <Label htmlFor="cv-subject" className="text-xs text-zinc-400">Subject *</Label>
            <Input
              id="cv-subject"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Data Structures, Physics, History…"
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600"
            />
            {/* Coding toggle */}
            <button
              type="button"
              onClick={() => setIsCoding(!isCoding)}
              className={`mt-1 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                ${isCoding
                  ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-400"
                  : "border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12]"
                }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              {isCoding ? "Coding subject ✓" : "Mark as coding subject"}
            </button>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="cv-desc" className="text-xs text-zinc-400">Description</Label>
            <Textarea
              id="cv-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this vault for?"
              rows={2}
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost"
              className="flex-1 text-zinc-400 hover:text-white hover:bg-white/[0.06]"
              onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !title.trim() || !subjectName.trim()}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white gap-2"
            >
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Vault"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
