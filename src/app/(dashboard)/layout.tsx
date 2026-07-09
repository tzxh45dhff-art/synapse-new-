import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authedApi } from "@/lib/server-api";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { SquadListItem } from "@/types/squad";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user's squads for sidebar using authedApi
  const clientApi = await authedApi();
  const squads = await clientApi.get<SquadListItem[]>("/squads").catch(() => [] as SquadListItem[]);

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <DashboardSidebar
          squads={squads}
          user={{
            id: user.id,
            email: user.email ?? "",
            name:
              user.user_metadata?.display_name ??
              user.user_metadata?.full_name ??
              user.email?.split("@")[0] ??
              "User",
            avatar_url: user.user_metadata?.avatar_url ?? null,
          }}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
