"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary. Without this, an unhandled render or data-fetch error
 * drops the user on Next's bare default screen with no way back.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="relative min-h-screen bg-[#07060d] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-0 h-[420px] w-[55%] bg-[radial-gradient(ellipse_at_top,#7c3aed33,transparent_60%)]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Something broke on our side</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
          The page failed to load. Retrying usually fixes it — if it keeps happening,
          the backend may be unreachable.
        </p>

        {error.message && (
          <pre className="mt-5 max-w-lg overflow-x-auto rounded-xl border border-white/[0.06] bg-black/40 p-3 text-left font-mono text-[11px] leading-relaxed text-zinc-500">
            {error.message}
            {error.digest ? `\n\nRef: ${error.digest}` : ""}
          </pre>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} className="gap-2 bg-violet-600 text-white hover:bg-violet-500">
            <RotateCcw className="h-4 w-4" /> Try again
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
    </div>
  );
}
