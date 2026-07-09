import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const onboardingCompleted = user.user_metadata?.onboarding_completed === true;
    redirect(onboardingCompleted ? "/dashboard" : "/onboarding");
  }

  redirect("/login");
}
