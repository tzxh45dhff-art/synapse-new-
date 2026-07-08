"use server";

import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";
import { revalidatePath } from "next/cache";

export async function transferOwnership(squadId: string, newOwnerId: string) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return { error: "Authentication required." };

  const result = await api.post(
    `/api/v1/squads/${squadId}/transfer-ownership`,
    { new_owner_id: newOwnerId },
    { token: session.access_token }
  );

  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/squads/${squadId}`);
  revalidatePath(`/dashboard/squads/${squadId}/members`);
  revalidatePath(`/dashboard/squads/${squadId}/settings`);
  return { success: true };
}
