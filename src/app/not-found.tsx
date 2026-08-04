import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="relative min-h-screen bg-[#07060d] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-0 h-[420px] w-[55%] bg-[radial-gradient(ellipse_at_top,#7c3aed33,transparent_60%)]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
          <Compass className="h-6 w-6 text-zinc-500" />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
          The link may be out of date, or the squad, vault or note it pointed to has
          since been deleted.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button className="bg-violet-600 text-white hover:bg-violet-500">
              Go to dashboard
            </Button>
          </Link>
          <Link href="/dashboard/squads">
            <Button
              variant="outline"
              className="border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]"
            >
              Browse squads
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
