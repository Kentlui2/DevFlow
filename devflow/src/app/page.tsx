import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Circle, CircleDot, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMascot } from "@/components/shared/brand-mascot";

const features = [
  { title: "Plan work", description: "Turn project goals into clear, manageable tasks." },
  { title: "Track progress", description: "See work move through a shared development workflow." },
  { title: "Stay in sync", description: "Keep project decisions and activity in one place." },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="bg-background/95 sticky top-0 z-20 border-b backdrop-blur">
        <nav aria-label="Main navigation" className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link className="flex items-center gap-2 font-semibold tracking-tight" href="/">
            <BrandMascot className="h-9 w-12 object-contain" />
            DevFlow
          </Link>
          <div className="hidden items-center gap-7 text-sm md:flex">
            <a className="text-muted-foreground hover:text-foreground" href="#features">Features</a>
            <a className="text-muted-foreground hover:text-foreground" href="#workflow">Workflow</a>
            <a className="text-muted-foreground hover:text-foreground" href="#about">About</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button asChild size="sm" variant="ghost"><Link href="/login">Log in</Link></Button>
            <Button asChild size="sm"><Link href="/register">Get started <ArrowUpRight aria-hidden="true" className="size-4" /></Link></Button>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
        <div className="max-w-2xl">
          <div className="text-primary inline-flex items-center gap-2 rounded-full border bg-primary/5 px-3 py-1.5 text-xs font-medium">
            <Layers3 aria-hidden="true" className="size-3.5" /> A focused workspace for software teams
          </div>
          <h1 className="mt-6 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Project management for software teams.
          </h1>
          <p className="text-muted-foreground mt-5 max-w-xl text-base leading-7 sm:text-lg">
            Plan work. Track progress. Collaborate with your team. DevFlow keeps your projects, tasks, and team workflow together.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/register">Get started <ArrowRight aria-hidden="true" className="size-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><a href="#workflow">Explore the workflow</a></Button>
          </div>
          <p className="text-muted-foreground mt-4 text-xs">A clear view of the work, from first task to done.</p>
        </div>

        <section aria-label="Preview of a DevFlow task board" className="rounded-xl border bg-card p-3 shadow-sm sm:p-5">
          <div className="flex items-center justify-between border-b px-2 pb-4">
            <div>
              <p className="text-muted-foreground text-xs">PROJECT / DEVFLOW</p>
              <h2 className="mt-1 text-sm font-semibold">Team workflow</h2>
            </div>
            <span className="text-muted-foreground rounded-md border px-2.5 py-1 text-[11px]">Board preview</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-4 sm:gap-3">
            {[
              { title: "TODO", count: "4", tasks: [{ id: "DF-137", name: "Polish login flow", icon: Circle }, { id: "DF-141", name: "Add task filters", icon: Circle }] },
              { title: "IN PROGRESS", count: "3", tasks: [{ id: "DF-129", name: "Session handling", icon: CircleDot }, { id: "DF-134", name: "Project overview", icon: CircleDot }] },
              { title: "DONE", count: "6", tasks: [{ id: "DF-120", name: "Set up database", icon: Check }, { id: "DF-124", name: "Create app scaffold", icon: Check }] },
            ].map((column) => (
              <section className="min-w-0" key={column.title}>
                <div className="mb-3 flex items-center justify-between gap-1">
                  <h3 className="truncate text-[10px] font-semibold tracking-wide sm:text-xs">{column.title}</h3>
                  <span className="text-muted-foreground text-[10px]">{column.count}</span>
                </div>
                <ul className="space-y-2">
                  {column.tasks.map(({ id, name, icon: Icon }) => (
                    <li className="rounded-md border bg-background p-2.5 sm:p-3" key={id}>
                      <p className="text-muted-foreground flex items-center gap-1 text-[9px] sm:text-[10px]">
                        <Icon aria-hidden="true" className="size-3" /> {id}
                      </p>
                      <p className="mt-2 line-clamp-2 text-[11px] leading-4 font-medium sm:text-xs">{name}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[9px]">MEDIUM</span>
                        <span aria-hidden="true" className="bg-muted text-muted-foreground grid size-5 place-items-center rounded-full text-[9px]">K</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="text-muted-foreground border-t mt-4 px-2 pt-3 text-xs">A shared view keeps the next step clear.</p>
        </section>
      </section>

      <section className="border-y bg-muted/30" id="features">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-3 md:py-16">
          {features.map((feature, index) => (
            <article className="max-w-sm" key={feature.title}>
              <p className="text-primary font-mono text-xs">0{index + 1}</p>
              <h2 className="mt-3 text-lg font-semibold">{feature.title}</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-6">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 md:py-20" id="workflow">
        <p className="text-primary text-xs font-semibold tracking-wide uppercase">A clear path through the work</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">From the backlog to done.</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">Use a shared workflow to see what is ready, what is moving, and what needs review.</p>
        <ol aria-label="Default task workflow" className="mt-8 grid gap-2 sm:grid-cols-5">
          {[
            ["Backlog", "bg-muted text-muted-foreground"],
            ["To do", "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"],
            ["In progress", "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"],
            ["In review", "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300"],
            ["Done", "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"],
          ].map(([status, tone], index) => (
            <li className="flex items-center gap-2" key={status}>
              <span className={`flex h-11 flex-1 items-center gap-2 rounded-md border px-3 text-sm font-medium ${tone}`}>
                <span aria-hidden="true" className="size-2 rounded-full bg-current" />{status}
              </span>
              {index < 4 ? <ArrowRight aria-hidden="true" className="text-muted-foreground hidden size-4 shrink-0 sm:block" /> : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-muted/30 border-t" id="about">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-10 sm:px-8">
          <div>
            <h2 className="font-semibold">Built for teams that build software.</h2>
            <p className="text-muted-foreground mt-1 text-sm">A focused project workspace with clear roles and a practical development workflow.</p>
          </div>
          <Button asChild variant="outline"><Link href="/register">Create your workspace</Link></Button>
        </div>
      </section>
    </main>
  );
}
