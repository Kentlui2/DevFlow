import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="text-muted-foreground font-mono text-sm">DevFlow</span>
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight">
        A focused workspace for software development teams.
      </h1>
      <p className="text-muted-foreground max-w-md">
        Projects, tasks, sprints, and activity — in one place. Phase 2 of the
        build: foundation scaffolding. Auth lands in Phase 3.
      </p>
      <div className="flex gap-3">
        <Button>Get started</Button>
        <Button variant="outline">Learn more</Button>
      </div>
    </main>
  );
}
