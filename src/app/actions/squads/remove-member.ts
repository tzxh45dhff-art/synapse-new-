"use server";

import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";
import { revalidatePath } from "next/cache";

export async function removeMember(squadId: string, userId: string) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return { error: "Authentication required." };

  const result = await api.delete(
    `/api/v1/squads/${squadId}/members/${userId}`,
    { token: session.access_token }
  );

  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/squads/${squadId}/members`);
  return { success: true };
}
