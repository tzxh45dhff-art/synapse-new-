"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dashboard-scoped error boundary: keeps the shell (nav, top bar) mounted so a
 * failure in one section doesn't strand the user outside the app.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard section failed:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-20 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
        <AlertTriangle className="h-6 w-6 text-red-400" />
      </div>
      <h2 className="text-lg font-semibold text-white">This section didn&apos;t load</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} className="gap-2 bg-violet-600 text-white hover:bg-violet-500">
          <RotateCcw className="h-4 w-4" /> Retry
        </Button>
        <Link href="/dashboard">
          <Button
            variant="outline"
            className="border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]"
          >
            Back to dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
