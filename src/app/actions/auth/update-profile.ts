"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const displayName = (formData.get("display_name") as string)?.trim();

  if (!displayName) {
    return { error: "Display name is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Authentication failed. Please log in again." };
  }

  const { error: updateAuthError } = await supabase.auth.updateUser({
    data: { display_name: displayName },
  });

  if (updateAuthError) {
    return { error: updateAuthError.message };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ display_name: displayName } as never)
    .eq("id", user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
