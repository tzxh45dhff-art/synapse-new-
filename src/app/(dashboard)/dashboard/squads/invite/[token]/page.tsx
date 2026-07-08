"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { SquadAvatar } from "@/components/squads/squad-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { acceptInvitation } from "@/app/actions/squads/accept-invitation";
import { declineInvitation } from "@/app/actions/squads/decline-invitation";
import type { InvitationPublic } from "@/types/squad";

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const [invitation, setInvitation] = useState<InvitationPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);

      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/v1/invitations/${token}`);
      if (res.ok) {
        setInvitation(await res.json());
      }
      setLoading(false);
    }
    load();
  }, [token]);

  async function handleAccept() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/dashboard/squads/invite/${token}`);
      return;
    }
    setAccepting(true);
    const result = await acceptInvitation(token);
    if (result?.error) {
      toast.error(result.error);
      setAccepting(false);
    }
  }

  async function handleDecline() {
    setDeclining(true);
    const result = await declineInvitation(token);
    if (result.error) {
      toast.error(result.error);
      setDeclining(false);
      return;
    }
    toast.success("Invitation declined");
    router.push("/dashboard/squads");
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <XCircle className="mb-4 h-12 w-12 text-destructive/50" />
        <h2 className="text-xl font-semibold">Invalid Invitation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This invitation link is invalid or has been revoked.
        </p>
        <Button className="mt-6" onClick={() => router.push("/dashboard/squads")}>
          Go to Squads
        </Button>
      </div>
    );
  }

  if (invitation.is_expired || invitation.status === "expired") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-amber-500/50" />
        <h2 className="text-xl font-semibold">Invitation Expired</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This invitation has expired. Ask a squad admin for a new one.
        </p>
        <Button className="mt-6" onClick={() => router.push("/dashboard/squads")}>
          Go to Squads
        </Button>
      </div>
    );
  }

  if (invitation.status !== "pending") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-500/50" />
        <h2 className="text-xl font-semibold">
          Invitation Already {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
        </h2>
        <Button className="mt-6" onClick={() => router.push("/dashboard/squads")}>
          Go to Squads
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border border-border/50 bg-card p-8 text-center shadow-lg"
      >
        <div className="flex justify-center">
          <SquadAvatar
            name={invitation.squad_name}
            avatarUrl={invitation.squad_avatar_url}
            size="xl"
          />
        </div>

        <h2 className="mt-4 text-xl font-bold">{invitation.squad_name}</h2>

        {invitation.inviter_name && (
          <p className="mt-1 text-sm text-muted-foreground">
            Invited by <span className="font-medium text-foreground">{invitation.inviter_name}</span>
          </p>
        )}

        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {invitation.squad_member_count} members
          </div>
          <Badge variant="outline" className="text-[10px] capitalize">
            {invitation.role}
          </Badge>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Expires {new Date(invitation.expires_at).toLocaleDateString()}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDecline}
            disabled={declining || accepting}
          >
            {declining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Decline
          </Button>
          <Button
            className="flex-1"
            onClick={handleAccept}
            disabled={accepting || declining}
          >
            {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoggedIn ? "Accept & Join" : "Login & Join"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
