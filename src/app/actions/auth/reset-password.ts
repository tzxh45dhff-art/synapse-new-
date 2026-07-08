"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { authRateLimit } from "@/lib/ratelimit";

export async function resetPassword(formData: FormData) {
  if (authRateLimit) {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "unknown";
    const { success } = await authRateLimit.limit(ip);
    
    if (!success) {
      return { error: "Too many requests. Please try again later." };
    }
  }

  const email = formData.get("email") as string;
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
