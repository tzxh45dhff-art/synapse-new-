import { Skeleton } from "@/components/ui/skeleton";

export function SquadCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <div className="flex items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-20 mt-2" />
        </div>
      </div>
    </div>
  );
}

export function SquadGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SquadCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MemberCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/50 bg-card p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-36" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

export function MemberListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <MemberCardSkeleton key={i} />
      ))}
    </div>
  );
}
