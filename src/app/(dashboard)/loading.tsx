/**
 * Route-level loading state for every dashboard page. Server components here
 * await the backend, so without this the app looks frozen on navigation.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-white/[0.05]" />
      <div className="h-4 w-80 animate-pulse rounded bg-white/[0.03]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
