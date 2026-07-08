"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Loader2, Plus, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createVault } from "@/app/actions/vaults/create-vault";
import type { SubjectItem } from "@/types/vault";

const ACCENT_COLORS = [
  "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B",
  "#EF4444", "#EC4899", "#06B6D4", "#84CC16",
];

const VAULT_ICONS = ["📚", "🧠", "💡", "🔬", "📐", "🌐", "⚡", "🎯", "🔮", "🛠️", "📊", "🏗️"];

interface CreateVaultDialogProps {
  squadId: string;
  subjects: SubjectItem[];
  trigger?: React.ReactNode;
}

export function CreateVaultDialog({ squadId, subjects, trigger }: CreateVaultDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
  const [selectedColor, setSelectedColor] = useState(ACCENT_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState("📚");

  function reset() {
    setTitle("");
    setDescription("");
    setSelectedSubject(null);
    setSelectedColor(ACCENT_COLORS[0]);
    setSelectedIcon("📚");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSubject) { setError("Please select a subject."); return; }
    if (!title.trim()) { setError("Title is required."); return; }

    startTransition(async () => {
      try {
        const vault = await createVault(squadId, {
          title: title.trim(),
          subject_id: selectedSubject.id,
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline"
                    className="w-14 h-10 text-xl border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08]">
                    {selectedIcon}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2 bg-zinc-900 border-white/[0.08]">
                  <div className="grid grid-cols-6 gap-1">
                    {VAULT_ICONS.map((icon) => (
                      <button key={icon} type="button"
                        onClick={() => setSelectedIcon(icon)}
                        className={`text-xl p-1.5 rounded-md hover:bg-white/[0.08] transition-colors
                          ${selectedIcon === icon ? "bg-white/[0.12] ring-1 ring-violet-500/50" : ""}`}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
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
            <Label htmlFor="vault-title" className="text-xs text-zinc-400">Title *</Label>
            <Input id="vault-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Data Structures & Algorithms"
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Subject *</Label>
            <Popover open={subjectOpen} onOpenChange={setSubjectOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline"
                  className="w-full justify-start bg-white/[0.04] border-white/[0.08]
                    text-white hover:bg-white/[0.08] font-normal">
                  {selectedSubject
                    ? <>{selectedSubject.icon} {selectedSubject.name}</>
                    : <span className="text-zinc-500">Select subject...</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-72 bg-zinc-900 border-white/[0.08]">
                <Command className="bg-transparent">
                  <CommandInput placeholder="Search subjects..." className="text-white" />
                  <CommandList>
                    <CommandEmpty className="text-zinc-500 text-sm py-4 text-center">
                      No subjects found.
                    </CommandEmpty>
                    <CommandGroup>
                      {subjects.map((s) => (
                        <CommandItem key={s.id} value={s.name}
                          onSelect={() => { setSelectedSubject(s); setSubjectOpen(false); }}
                          className="text-white hover:bg-white/[0.08] cursor-pointer gap-2">
                          <span>{s.icon}</span>
                          <span>{s.name}</span>
                          {selectedSubject?.id === s.id && (
                            <Check className="w-4 h-4 ml-auto text-violet-400" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="vault-desc" className="text-xs text-zinc-400">Description</Label>
            <Textarea id="vault-desc" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this vault for?"
              rows={2}
              className="bg-white/[0.04] border-white/[0.08] text-white
                placeholder:text-zinc-600 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost"
              className="flex-1 text-zinc-400 hover:text-white hover:bg-white/[0.06]"
              onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title.trim() || !selectedSubject}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white gap-2">
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Vault"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
