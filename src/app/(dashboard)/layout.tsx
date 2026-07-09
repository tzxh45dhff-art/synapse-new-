import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TopBar } from "@/components/shell/top-bar";
import { DashboardNav } from "@/components/shell/dashboard-nav";

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

  const name =
    user.user_metadata?.display_name ??
    user.user_metadata?.full_name ??
    user.email?.split("@")[0] ??
    "User";

  return (
    <TooltipProvider>
      <div className="relative min-h-screen bg-[#07060d] text-white">
        {/* aurora glow */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 right-0 h-[420px] w-[55%] bg-[radial-gradient(ellipse_at_top,#7c3aed33,transparent_60%)]" />
          <div className="absolute -top-24 left-10 h-[380px] w-[45%] bg-[radial-gradient(ellipse_at_top,#22d3ee22,transparent_60%)]" />
        </div>

        <div className="relative z-10 px-5 pb-28 pt-6 sm:px-8">
          <TopBar
            name={name}
            email={user.email ?? ""}
            avatarUrl={user.user_metadata?.avatar_url ?? null}
          />
          <div className="mt-8">{children}</div>
        </div>

        <DashboardNav />
      </div>
    </TooltipProvider>
  );
}
