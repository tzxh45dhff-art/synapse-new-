"use server";

import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function acceptInvitation(token: string) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return { error: "Authentication required." };

  const result = await api.post<{ squad_id: string; role: string }>(
    `/api/v1/invitations/${token}/accept`, {}, {
    token: session.access_token,
  });

  if (result.error) return { error: result.error };

  revalidatePath("/dashboard/squads");

  if (result.data?.squad_id) {
    redirect(`/dashboard/squads/${result.data.squad_id}`);
  }

  return { data: result.data };
}
