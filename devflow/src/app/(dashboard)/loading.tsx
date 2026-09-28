import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div aria-label="Loading workspace" className="space-y-8" role="status">
      <span className="sr-only">Loading workspace…</span>
      <header className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Skeleton className="h-28" key={item} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        {[0, 1].map((item) => (
          <Skeleton className="h-80" key={item} />
        ))}
      </div>
    </div>
  );
}
