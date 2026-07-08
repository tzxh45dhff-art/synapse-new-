"use server";

import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";
import { revalidatePath } from "next/cache";

export async function inviteMember(squadId: string, role: string = "member") {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return { error: "Authentication required." };

  const result = await api.post(`/api/v1/squads/${squadId}/invite`, { role }, {
    token: session.access_token,
  });

  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/squads/${squadId}`);
  return { data: result.data };
}
