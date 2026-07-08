"use server";

import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";
import { revalidatePath } from "next/cache";

export async function changeRole(squadId: string, userId: string, role: string) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return { error: "Authentication required." };

  const result = await api.patch(
    `/api/v1/squads/${squadId}/members/${userId}`,
    { role },
    { token: session.access_token }
  );

  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/squads/${squadId}/members`);
  return { data: result.data };
}
