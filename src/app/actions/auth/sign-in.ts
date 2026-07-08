"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { authRateLimit } from "@/lib/ratelimit";

export async function signIn(formData: FormData) {
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
  const nextPath = (formData.get("next") as string) || "/dashboard";

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}

export async function signInWithGoogle(nextPath: string = "/dashboard") {
  if (authRateLimit) {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "unknown";
    const { success } = await authRateLimit.limit(ip);
    
    if (!success) {
      return { error: "Too many requests. Please try again later." };
    }
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }
}
