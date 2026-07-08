"use server";

import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";
import { revalidatePath } from "next/cache";

export async function updateSquad(
  squadId: string,
  data: {
    name?: string;
    description?: string;
    avatar_url?: string;
    max_members?: number;
  }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return { error: "Authentication required." };

  const result = await api.patch(`/api/v1/squads/${squadId}`, data, {
    token: session.access_token,
  });

  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/squads/${squadId}`);
  revalidatePath("/dashboard/squads");
  return { data: result.data };
}
