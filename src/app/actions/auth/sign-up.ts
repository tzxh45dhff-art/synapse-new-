"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authRateLimit } from "@/lib/ratelimit";

export async function signUp(formData: FormData) {
  if (authRateLimit) {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "unknown";
    const { success } = await authRateLimit.limit(ip);
    
    if (!success) {
      return { error: "Too many requests. Please try again later." };
    }
  }

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("full_name") as string;
  const university = formData.get("university") as string;

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name: fullName,
        university: university,
        onboarding_completed: true,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
