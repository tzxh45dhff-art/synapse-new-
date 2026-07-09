import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata = {
  title: "Settings — Bunker",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const name =
    user?.user_metadata?.display_name ??
    user?.user_metadata?.full_name ??
    user?.email?.split("@")[0] ??
    "";

  return (
    <SettingsView
      name={name}
      email={user?.email ?? ""}
      avatarUrl={user?.user_metadata?.avatar_url ?? null}
    />
  );
}
