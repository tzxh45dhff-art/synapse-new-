"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function completeOnboarding(formData: FormData) {
  const displayName = formData.get("display_name") as string;
  const university = formData.get("university") as string;
  const yearOfStudy = parseInt(formData.get("year_of_study") as string) || null;
  const timezone = formData.get("timezone") as string;

  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Authentication failed. Please log in again." };
  }

  // 1. Update the user metadata in Supabase Auth
  // We use this flag in the middleware to avoid database queries on every page load
  const { error: updateAuthError } = await supabase.auth.updateUser({
    data: {
      onboarding_completed: true,
      display_name: displayName,
    },
  });

  if (updateAuthError) {
    return { error: updateAuthError.message };
  }

  const payload: any = {
    display_name: displayName,
    university: university,
    year_of_study: yearOfStudy,
    timezone: timezone,
    onboarding_completed: true,
  };

  // 2. Update the profiles table
  const { error: profileError } = await supabase
    .from("profiles")
    .update(payload as never)
    .eq("id", user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  // Done! Redirect to the main app area
  redirect("/dashboard");
}
