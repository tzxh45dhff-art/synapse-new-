"use server";

import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";
import { revalidatePath } from "next/cache";

export async function createSquad(data: {
  name: string;
  description?: string;
  avatar_url?: string;
}) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Authentication required." };
  }

  const result = await api.post("/api/v1/squads", data, {
    token: session.access_token,
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/dashboard/squads");
  return { data: result.data };
}
