"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { User, Lock, LogOut, Loader2, Save } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/app/actions/auth/update-profile";
import { updatePassword } from "@/app/actions/auth/update-password";
import { signOut } from "@/app/actions/auth/sign-out";

interface SettingsViewProps {
  name: string;
  email: string;
  avatarUrl: string | null;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

export function SettingsView({ name, email, avatarUrl }: SettingsViewProps) {
  const [displayName, setDisplayName] = useState(name);
  const [savingProfile, startProfileSave] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, startPasswordSave] = useTransition();
  const [signingOut, startSignOut] = useTransition();

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("display_name", displayName);
    startProfileSave(async () => {
      const result = await updateProfile(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Profile updated.");
      }
    });
  }

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    const formData = new FormData();
    formData.set("password", password);
    startPasswordSave(async () => {
      try {
        const result = await updatePassword(formData);
        if (result?.error) {
          toast.error(result.error);
        }
      } catch {
        // updatePassword redirects on success, which surfaces as a thrown
        // NEXT_REDIRECT signal — that's the success path, not a failure.
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-white/50">Manage your profile and account.</p>
      </div>

      {/* Profile */}
      <Panel>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-violet-400" />
          <h2 className="font-semibold">Profile</h2>
        </div>
        <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-white/10">
              <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback className="bg-gradient-to-br from-violet-400 to-indigo-500 text-lg font-semibold text-white">
                {displayName.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="display_name" className="text-xs text-white/50">
                Display name
              </Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                className="border-white/[0.08] bg-white/[0.04] text-white"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Email</Label>
            <Input value={email} disabled className="border-white/[0.06] bg-white/[0.02] text-white/50" />
          </div>
          <Button
            type="submit"
            disabled={savingProfile || !displayName.trim()}
            className="gap-2 bg-violet-600 text-white hover:bg-violet-500"
          >
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </form>
      </Panel>

      {/* Security */}
      <Panel>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-violet-400" />
          <h2 className="font-semibold">Security</h2>
        </div>
        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new_password" className="text-xs text-white/50">
              New password
            </Label>
            <Input
              id="new_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="border-white/[0.08] bg-white/[0.04] text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm_password" className="text-xs text-white/50">
              Confirm new password
            </Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="border-white/[0.08] bg-white/[0.04] text-white"
            />
          </div>
          <Button
            type="submit"
            disabled={savingPassword || !password || !confirmPassword}
            variant="outline"
            className="gap-2 border-white/[0.08] text-white hover:bg-white/[0.06]"
          >
            {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </form>
      </Panel>

      {/* Danger zone */}
      <Panel className="border-red-900/30 bg-red-950/10">
        <h2 className="font-semibold text-red-400">Sign Out</h2>
        <p className="mt-1 text-sm text-white/50">
          You&apos;ll need to log in again to access your vaults and squads.
        </p>
        <Button
          onClick={() => startSignOut(() => signOut())}
          disabled={signingOut}
          className="mt-4 gap-2 bg-red-600 text-white hover:bg-red-500"
        >
          {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Sign Out
        </Button>
      </Panel>
    </div>
  );
}
