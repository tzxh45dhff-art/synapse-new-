"use server";

import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function leaveSquad(squadId: string) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return { error: "Authentication required." };

  const result = await api.post(`/api/v1/squads/${squadId}/leave`, {}, {
    token: session.access_token,
  });

  if (result.error) return { error: result.error };

  revalidatePath("/dashboard/squads");
  redirect("/dashboard/squads");
}
