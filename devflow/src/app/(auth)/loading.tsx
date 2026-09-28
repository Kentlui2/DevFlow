import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <main
      aria-label="Loading authentication page"
      className="bg-muted/30 grid min-h-screen place-items-center p-4"
      role="status"
    >
      <span className="sr-only">Loading sign-in form…</span>
      <section className="bg-card w-full max-w-md rounded-xl border p-6 shadow-sm sm:p-8">
        <Skeleton className="mx-auto h-10 w-24" />
        <Skeleton className="mx-auto mt-8 h-7 w-48 max-w-full" />
        <Skeleton className="mx-auto mt-3 h-4 w-60 max-w-full" />
        <div className="mt-8 space-y-5">
          {[0, 1].map((item) => (
            <div className="space-y-2" key={item}>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-9 w-full" />
        </div>
      </section>
    </main>
  );
}
