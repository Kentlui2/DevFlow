import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bug,
  CheckCircle2,
  CircleDashed,
  Gauge,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  AnalyticsBar,
  ProjectAnalytics,
} from "@/lib/services/analyticsService";

export function AnalyticsDashboard({
  projectId,
  projectName,
  analytics,
  loadError,
}: {
  projectId: string;
  projectName: string;
  analytics: ProjectAnalytics | null;
  loadError: boolean;
}) {
  return (
    <div className="space-y-6">
      <header>
        <Link
          className="text-muted-foreground hover:text-foreground text-sm"
          href={`/projects/${projectId}`}
        >
          {projectName}
        </Link>
        <p className="text-muted-foreground mt-3 text-sm">Project workspace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Analytics
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
          See what is moving, what is getting stuck, and how work is distributed
          across your team.
        </p>
      </header>

      {loadError || !analytics ? (
        <section
          className="text-destructive border-destructive/30 bg-destructive/5 rounded-lg border px-4 py-4 text-sm"
          role="alert"
        >
          Project analytics could not be loaded. Refresh the page to try again.
        </section>
      ) : (
        <>
          <section
            aria-label="Project metrics"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            <SummaryCard
              icon={BarChart3}
              label="Tasks completed"
              value={`${analytics.completedTasks} / ${analytics.totalTasks}`}
              detail={`${analytics.taskCompletionRate}% of project tasks`}
            />
            <SummaryCard
              icon={Bug}
              label="Unresolved issues"
              value={analytics.unresolvedIssues}
              detail={`${analytics.resolvedIssues} resolved or closed`}
            />
            <SummaryCard
              icon={Gauge}
              label="Sprint velocity"
              value={analytics.averageVelocity}
              detail="Tasks completed per sprint · last 5 completed"
            />
            <SummaryCard
              icon={Activity}
              label="Recent activity"
              value={analytics.activityLast30Days}
              detail="Project updates in the last 30 days"
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <ChartPanel
              icon={CheckCircle2}
              title="Task progress"
              description="How much of the project work is finished?"
            >
              <div className="mb-4 flex items-end justify-between gap-3">
                <p className="text-3xl font-semibold tabular-nums">
                  {analytics.taskCompletionRate}%
                </p>
                <p className="text-muted-foreground text-right text-xs">
                  {analytics.completedTasks} completed of {analytics.totalTasks}{" "}
                  tasks
                </p>
              </div>
              <div
                aria-label="Project task completion"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={analytics.taskCompletionRate}
                className="bg-muted h-2.5 overflow-hidden rounded-full"
                role="progressbar"
              >
                <div
                  className="bg-primary h-full rounded-full transition-[width]"
                  style={{ width: `${analytics.taskCompletionRate}%` }}
                />
              </div>
              <BarList bars={analytics.tasksByStatus} colors={statusColors} />
            </ChartPanel>

            <ChartPanel
              icon={Bug}
              title="Issue health"
              description="Are reported problems being resolved?"
            >
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="bg-muted/35 rounded-md border p-3">
                  <p className="text-muted-foreground text-xs">
                    Open or in progress
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {analytics.unresolvedIssues}
                  </p>
                </div>
                <div className="bg-muted/35 rounded-md border p-3">
                  <p className="text-muted-foreground text-xs">
                    Resolved or closed
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {analytics.resolvedIssues}
                  </p>
                </div>
              </div>
              <BarList bars={analytics.issuesByStatus} colors={issueColors} />
              {!analytics.totalIssues ? (
                <p className="text-muted-foreground mt-3 text-xs">
                  No issues have been reported in this project.
                </p>
              ) : null}
            </ChartPanel>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <ChartPanel
              icon={CircleDashed}
              title="Priority mix"
              description="Where is the team’s attention concentrated?"
            >
              <BarList
                bars={analytics.tasksByPriority}
                colors={priorityColors}
              />
              {!analytics.totalTasks ? (
                <p className="text-muted-foreground mt-3 text-xs">
                  Create project tasks to see priority distribution.
                </p>
              ) : null}
            </ChartPanel>

            <ChartPanel
              icon={Activity}
              title="Project activity"
              description="Updates recorded over the last eight weeks."
            >
              <div className="grid grid-cols-4 gap-2 pt-1 sm:grid-cols-8">
                {analytics.activityByWeek.map((week) => {
                  const maximum = Math.max(
                    1,
                    ...analytics.activityByWeek.map((item) => item.value)
                  );
                  const height = week.value
                    ? Math.max(8, Math.round((week.value / maximum) * 100))
                    : 2;
                  return (
                    <div
                      className="flex min-w-0 flex-col items-center gap-2"
                      key={week.key}
                    >
                      <span className="text-muted-foreground text-[10px] tabular-nums">
                        {week.value}
                      </span>
                      <div
                        aria-label={`${week.label}: ${week.value} activity updates`}
                        className="bg-muted flex h-24 w-full items-end overflow-hidden rounded"
                        role="img"
                      >
                        <span
                          className="bg-primary/75 block w-full rounded transition-[height]"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground w-full truncate text-center text-[10px]">
                        {week.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-muted-foreground mt-3 text-xs">
                {analytics.activityLast30Days} updates in the last 30 days
              </p>
            </ChartPanel>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <ChartPanel
              icon={Gauge}
              title="Sprint performance"
              description="What did the team finish in each completed sprint?"
            >
              {analytics.velocityPoints.length ? (
                <>
                  <div className="bg-muted/20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                    <span className="text-sm font-medium">
                      Historical sprint completion
                    </span>
                    <span className="text-lg font-semibold tabular-nums">
                      {analytics.historicalSprintCompletionRate}%
                    </span>
                    <span className="text-muted-foreground w-full text-xs">
                      {analytics.historicalSprintCompleted} completed out of{" "}
                      {analytics.historicalSprintScope} scoped tasks across{" "}
                      {analytics.historicalSprintCount} completed sprints with
                      tasks
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {analytics.velocityPoints.map((sprint) => (
                      <li
                        className="grid grid-cols-[minmax(6rem,0.8fr)_minmax(6rem,1.4fr)_auto] items-center gap-3 text-sm"
                        key={sprint.id}
                      >
                        <span className="truncate font-medium">
                          {sprint.name}
                        </span>
                        <div
                          aria-label={`${sprint.completed} of ${sprint.scope} tasks completed`}
                          aria-valuemax={sprint.scope}
                          aria-valuemin={0}
                          aria-valuenow={sprint.completed}
                          className="bg-muted h-2 overflow-hidden rounded-full"
                          role="progressbar"
                        >
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{
                              width: `${sprint.scope ? (sprint.completed / sprint.scope) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {sprint.completed} / {sprint.scope}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground mt-4 text-xs">
                    Velocity counts completed tasks, not story points. The chart
                    shows the five most recent completed sprints.
                  </p>
                </>
              ) : (
                <EmptyMetric
                  text="Complete a sprint with tasks to see delivery rate and velocity over time."
                  linkHref={`/projects/${projectId}/sprints`}
                  linkLabel="View sprints"
                />
              )}
            </ChartPanel>

            <ChartPanel
              icon={CircleDashed}
              title="Current sprint"
              description="How is the active development cycle progressing?"
            >
              {analytics.activeSprint ? (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {analytics.activeSprint.name}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatDate(analytics.activeSprint.startDate)} –{" "}
                        {formatDate(analytics.activeSprint.endDate)}
                      </p>
                    </div>
                    <span className="text-primary text-lg font-semibold tabular-nums">
                      {analytics.activeSprint.progress}%
                    </span>
                  </div>
                  <div
                    aria-label="Current sprint completion"
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={analytics.activeSprint.progress}
                    className="bg-muted mt-4 h-2.5 overflow-hidden rounded-full"
                    role="progressbar"
                  >
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${analytics.activeSprint.progress}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {analytics.activeSprint.completed} of{" "}
                    {analytics.activeSprint.scope} sprint tasks complete
                  </p>
                  <Link
                    className="text-primary mt-5 inline-flex items-center gap-1 text-sm font-medium hover:underline"
                    href={`/projects/${projectId}/sprints`}
                  >
                    Open sprint plan{" "}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </div>
              ) : (
                <EmptyMetric
                  text="There is no active sprint. Start a planned sprint to track its progress here."
                  linkHref={`/projects/${projectId}/sprints`}
                  linkLabel="Manage sprints"
                />
              )}
            </ChartPanel>
          </section>

          <ChartPanel
            icon={UsersRound}
            title="Team workload"
            description="How many unfinished tasks are assigned to each project member?"
          >
            {analytics.workload.length ? (
              <div className="space-y-4">
                {analytics.workload.map((member) => {
                  const maximum = Math.max(
                    1,
                    ...analytics.workload.map((item) => item.active)
                  );
                  const width = Math.round((member.active / maximum) * 100);
                  return (
                    <div
                      className="grid gap-2 sm:grid-cols-[minmax(8rem,0.6fr)_minmax(8rem,1.8fr)_auto] sm:items-center sm:gap-4"
                      key={member.id}
                    >
                      <span className="truncate text-sm font-medium">
                        {member.name}
                      </span>
                      <div
                        aria-label={`${member.active} active tasks; ${member.inProgress} in progress`}
                        className="bg-muted h-2.5 overflow-hidden rounded-full"
                        role="img"
                      >
                        <span
                          className="bg-primary block h-full rounded-full"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {member.active} active · {member.inProgress} in progress
                        · {member.completed} done
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No project members or tasks are available to compare yet.
              </p>
            )}
          </ChartPanel>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="bg-card rounded-lg border p-4 sm:p-5">
      <div className="text-muted-foreground flex items-center gap-2">
        <Icon aria-hidden="true" className="size-4" />
        <h2 className="text-sm">{label}</h2>
      </div>
      <p className="mt-4 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-5">{detail}</p>
    </article>
  );
}

function ChartPanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card min-w-0 rounded-lg border p-4 sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-md">
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function BarList({
  bars,
  colors,
}: {
  bars: AnalyticsBar[];
  colors: Record<string, string>;
}) {
  const maximum = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <ul className="space-y-3">
      {bars.map((bar) => (
        <li
          className="grid grid-cols-[minmax(5rem,0.7fr)_minmax(4rem,1.5fr)_2rem] items-center gap-3 text-sm"
          key={bar.key}
        >
          <span className="text-muted-foreground truncate">{bar.label}</span>
          <div
            aria-label={`${bar.value} ${bar.label.toLocaleLowerCase()}`}
            className="bg-muted h-2 overflow-hidden rounded-full"
            role="img"
          >
            <span
              className={`block h-full rounded-full ${colors[bar.key] ?? "bg-primary"}`}
              style={{ width: `${Math.round((bar.value / maximum) * 100)}%` }}
            />
          </div>
          <span className="text-right text-xs tabular-nums">{bar.value}</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyMetric({
  text,
  linkHref,
  linkLabel,
}: {
  text: string;
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <div className="bg-muted/25 rounded-md border border-dashed px-4 py-6">
      <p className="text-muted-foreground text-sm leading-6">{text}</p>
      <Link
        className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
        href={linkHref}
      >
        {linkLabel} <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}

const statusColors: Record<string, string> = {
  backlog: "bg-slate-400",
  todo: "bg-blue-500",
  in_progress: "bg-amber-500",
  in_review: "bg-violet-500",
  done: "bg-emerald-500",
};
const priorityColors: Record<string, string> = {
  urgent: "bg-rose-600",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
};
const issueColors: Record<string, string> = {
  open: "bg-rose-500",
  in_progress: "bg-amber-500",
  resolved: "bg-emerald-500",
  closed: "bg-slate-400",
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
