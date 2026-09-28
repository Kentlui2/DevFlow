"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Circle,
  Pencil,
  Plus,
  Rocket,
  Trash2,
} from "lucide-react";
import type { Sprint } from "@/lib/types";
import type { TaskBoardItem } from "@/lib/types/task-board";
import type { SprintWithTasks } from "@/lib/services/sprintService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast } from "@/components/ui/toast";
import { ConfirmDialogButton } from "@/components/shared/confirm-dialog-button";

export function SprintWorkspace({
  projectId,
  projectName,
  initialSprints,
  canManage,
  loadError,
}: {
  projectId: string;
  projectName: string;
  initialSprints: SprintWithTasks[];
  canManage: boolean;
  loadError: boolean;
}) {
  const [sprints, setSprints] = useState(initialSprints);
  const [selectedId, setSelectedId] = useState(
    initialSprints.find((sprint) => sprint.status === "active")?.id ??
      initialSprints.find((sprint) => sprint.status === "planned")?.id ??
      initialSprints[0]?.id ??
      null
  );
  const [editor, setEditor] = useState<Sprint | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(
    loadError
      ? "Sprint information could not be loaded. Refresh the page to try again."
      : null
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const orderedSprints = useMemo(
    () =>
      [...sprints].sort((a, b) => {
        const rank = { active: 0, planned: 1, completed: 2 };
        return (
          rank[a.status] - rank[b.status] ||
          b.startDate.localeCompare(a.startDate)
        );
      }),
    [sprints]
  );
  const selectedSprint =
    sprints.find((sprint) => sprint.id === selectedId) ?? null;

  function saveSprint(saved: Sprint) {
    setSprints((current) => {
      const exists = current.some((sprint) => sprint.id === saved.id);
      return exists
        ? current.map((sprint) =>
            sprint.id === saved.id ? { ...sprint, ...saved } : sprint
          )
        : [{ ...saved, tasks: [] }, ...current];
    });
    setSelectedId(saved.id);
    setEditor(undefined);
    setError(null);
    setNotice(`“${saved.name}” saved.`);
  }

  async function changeStatus(sprint: Sprint, status: "active" | "completed") {
    setWorkingId(sprint.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/sprints/${sprint.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message ?? "Could not update this sprint.");
        return;
      }
      const saved = result.data as Sprint;
      setSprints((current) =>
        current.map((item) =>
          item.id === saved.id ? { ...item, ...saved } : item
        )
      );
      setNotice(
        status === "active"
          ? `${saved.name} is now active.`
          : `${saved.name} is complete.`
      );
    } catch {
      setError("We couldn’t reach DevFlow. Try again.");
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteSprint(sprintId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/sprints/${sprintId}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (!response.ok)
        return result.error?.message ?? "Could not delete this sprint.";
      const remaining = sprints.filter((sprint) => sprint.id !== sprintId);
      setSprints(remaining);
      if (selectedId === sprintId) setSelectedId(remaining[0]?.id ?? null);
      setNotice("Sprint deleted. Its tasks are back in the backlog.");
      return null;
    } catch {
      return "We couldn’t reach DevFlow. Check your connection and try again.";
    }
  }

  async function removeTask(sprintId: string, taskId: string) {
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/sprints/${sprintId}/tasks/${taskId}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(
          result.error?.message ?? "Could not return this task to the backlog."
        );
        return;
      }
      setSprints((current) =>
        current.map((sprint) =>
          sprint.id === sprintId
            ? {
                ...sprint,
                tasks: sprint.tasks.filter((task) => task.id !== taskId),
              }
            : sprint
        )
      );
      setNotice("Task returned to the backlog.");
    } catch {
      setError("We couldn’t reach DevFlow. Try again.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          className="text-muted-foreground hover:text-foreground text-sm"
          href={`/projects/${projectId}`}
        >
          {projectName}
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">Project workspace</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Sprints
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Plan focused work cycles and follow progress as tasks move across
              the board.
            </p>
          </div>
          {canManage ? (
            <Button onClick={() => setEditor(null)} type="button">
              <Plus aria-hidden="true" className="size-4" /> Create sprint
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p
          className="text-destructive border-destructive/30 bg-destructive/5 rounded-md border px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {notice ? <Toast key={notice} message={notice} /> : null}

      {orderedSprints.length ? (
        <>
          <nav
            aria-label="Project sprints"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {orderedSprints.map((sprint) => {
              const progress = getProgress(sprint.tasks);
              const selected = sprint.id === selectedId;
              return (
                <button
                  aria-pressed={selected}
                  className={`bg-card hover:border-primary/40 hover:bg-accent/20 focus-visible:ring-ring rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none ${selected ? "border-primary/50 ring-primary/30 ring-1" : ""}`}
                  key={sprint.id}
                  onClick={() => setSelectedId(sprint.id)}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{sprint.name}</span>
                    <SprintStatusBadge status={sprint.status} />
                  </span>
                  <span className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
                    <CalendarDays aria-hidden="true" className="size-3.5" />{" "}
                    {formatDateRange(sprint.startDate, sprint.endDate)}
                  </span>
                  <span className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
                    <span>
                      {sprint.tasks.length}{" "}
                      {sprint.tasks.length === 1 ? "task" : "tasks"}
                    </span>
                    <span>{progress.percent}% complete</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="bg-muted mt-2 block h-1.5 overflow-hidden rounded-full"
                  >
                    <span
                      className="bg-primary block h-full rounded-full transition-[width]"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </nav>

          {selectedSprint ? (
            <SprintDetails
              canManage={canManage}
              onComplete={() => void changeStatus(selectedSprint, "completed")}
              onDelete={() => deleteSprint(selectedSprint.id)}
              onEdit={() => setEditor(selectedSprint)}
              onRemoveTask={(taskId) =>
                void removeTask(selectedSprint.id, taskId)
              }
              onStart={() => void changeStatus(selectedSprint, "active")}
              projectId={projectId}
              sprint={selectedSprint}
              working={workingId === selectedSprint.id}
            />
          ) : null}
        </>
      ) : (
        <section className="bg-card flex min-h-64 flex-col items-center justify-center rounded-lg border px-6 text-center">
          <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-full">
            <Rocket aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 font-semibold">No sprints planned</h2>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            Create a sprint with a name and date range, then choose work from
            the backlog.
          </p>
          {canManage ? (
            <Button
              className="mt-4"
              onClick={() => setEditor(null)}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" /> Create sprint
            </Button>
          ) : null}
        </section>
      )}

      {editor !== undefined ? (
        <SprintFormDialog
          key={editor?.id ?? "new-sprint"}
          onClose={() => setEditor(undefined)}
          onSaved={saveSprint}
          projectId={projectId}
          sprint={editor}
        />
      ) : null}
    </div>
  );
}

function SprintDetails({
  sprint,
  projectId,
  canManage,
  working,
  onStart,
  onComplete,
  onEdit,
  onDelete,
  onRemoveTask,
}: {
  sprint: SprintWithTasks;
  projectId: string;
  canManage: boolean;
  working: boolean;
  onStart: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => Promise<string | null>;
  onRemoveTask: (taskId: string) => void;
}) {
  const progress = getProgress(sprint.tasks);
  const inProgress = sprint.tasks.filter(
    (task) => task.status === "in_progress" || task.status === "in_review"
  ).length;
  const remaining = sprint.tasks.length - progress.completed - inProgress;
  const statuses: Record<TaskBoardItem["status"], string> = {
    backlog: "Backlog",
    todo: "To do",
    in_progress: "In progress",
    in_review: "In review",
    done: "Done",
  };

  return (
    <section className="bg-card rounded-lg border">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b p-5 sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{sprint.name}</h2>
            <SprintStatusBadge status={sprint.status} />
          </div>
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-sm">
            <CalendarDays aria-hidden="true" className="size-4" />
            {formatDateRange(sprint.startDate, sprint.endDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="hover:bg-accent inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
            href={`/projects/${projectId}/backlog`}
          >
            Plan tasks <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link
            className="hover:bg-accent inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors"
            href={`/projects/${projectId}/board`}
          >
            Open board
          </Link>
          {canManage && sprint.status === "planned" ? (
            <Button onClick={onEdit} type="button" variant="outline">
              <Pencil aria-hidden="true" className="size-4" /> Edit
            </Button>
          ) : null}
          {canManage && sprint.status === "planned" ? (
            <Button disabled={working} onClick={onStart} type="button">
              <Rocket aria-hidden="true" className="size-4" />{" "}
              {working ? "Starting…" : "Start sprint"}
            </Button>
          ) : null}
          {canManage && sprint.status === "active" ? (
            <Button disabled={working} onClick={onComplete} type="button">
              <Check aria-hidden="true" className="size-4" />{" "}
              {working ? "Saving…" : "Complete sprint"}
            </Button>
          ) : null}
          {canManage ? (
            <ConfirmDialogButton
              confirmLabel="Delete sprint"
              description="This removes the sprint and returns its tasks to the project backlog."
              onConfirm={onDelete}
              title="Delete this sprint?"
              triggerLabel="Delete"
              destructive
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 border-b p-5 sm:grid-cols-3 sm:p-6">
        <Metric label="Completed" value={progress.completed} />
        <Metric label="In progress" value={inProgress} />
        <Metric label="Remaining" value={remaining} />
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Sprint tasks</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {progress.percent}% complete
            </p>
          </div>
          {sprint.tasks.length ? (
            <span className="text-muted-foreground text-xs">
              {sprint.tasks.length} total
            </span>
          ) : null}
        </div>
        <div
          aria-label="Sprint completion"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress.percent}
          className="bg-muted mt-3 h-2 overflow-hidden rounded-full"
          role="progressbar"
        >
          <div
            className="bg-primary h-full rounded-full transition-[width]"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        {sprint.tasks.length ? (
          <ul className="mt-4 divide-y">
            {sprint.tasks.map((task) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                key={task.id}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="text-muted-foreground mt-0.5">
                    {task.status === "done" ? (
                      <Check
                        aria-hidden="true"
                        className="text-primary size-4"
                      />
                    ) : (
                      <Circle aria-hidden="true" className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block truncate text-sm font-medium ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}
                    >
                      {task.title}
                    </span>
                    <span className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <span>{statuses[task.status]}</span>
                      <span className="capitalize">
                        {task.priority} priority
                      </span>
                      <span>
                        {task.assignee?.fullName ||
                          task.assignee?.email ||
                          "Unassigned"}
                      </span>
                    </span>
                  </span>
                </div>
                {canManage && sprint.status !== "completed" ? (
                  <Button
                    aria-label={`Return ${task.title} to backlog`}
                    className="h-8 px-2 text-xs"
                    onClick={() => onRemoveTask(task.id)}
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" /> Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="bg-muted/30 mt-4 rounded-md border border-dashed px-5 py-8 text-center">
            <p className="text-sm font-medium">No tasks in this sprint yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Select items from your project backlog to start planning.
            </p>
            {canManage ? (
              <Link
                className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
                href={`/projects/${projectId}/backlog`}
              >
                Open backlog{" "}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function SprintFormDialog({
  projectId,
  sprint,
  onClose,
  onSaved,
}: {
  projectId: string;
  sprint: Sprint | null;
  onClose: () => void;
  onSaved: (sprint: Sprint) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const values = new FormData(event.currentTarget);
    const body = {
      name: String(values.get("name") ?? "").trim(),
      startDate: String(values.get("startDate") ?? ""),
      endDate: String(values.get("endDate") ?? ""),
    };
    try {
      const response = await fetch(
        sprint
          ? `/api/projects/${projectId}/sprints/${sprint.id}`
          : `/api/projects/${projectId}/sprints`,
        {
          method: sprint ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message ?? "Could not save this sprint.");
        return;
      }
      onSaved(result.data as Sprint);
    } catch {
      setError("We couldn’t reach DevFlow. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      aria-labelledby="sprint-dialog-title"
      className="bg-background text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border p-0 shadow-xl backdrop:bg-black/40 motion-safe:duration-200 motion-safe:ease-out"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={dialogRef}
    >
      <div className="p-5 sm:p-6">
        <h2 className="text-xl font-semibold" id="sprint-dialog-title">
          {sprint ? "Edit sprint" : "Create sprint"}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose a clear name and date range for this development cycle.
        </p>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="sprint-name">Sprint name</Label>
            <Input
              autoFocus
              defaultValue={sprint?.name ?? ""}
              id="sprint-name"
              maxLength={100}
              name="name"
              placeholder="Sprint 1"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sprint-start-date">Start date</Label>
              <Input
                defaultValue={sprint?.startDate ?? ""}
                id="sprint-start-date"
                name="startDate"
                required
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sprint-end-date">End date</Label>
              <Input
                defaultValue={sprint?.endDate ?? ""}
                id="sprint-end-date"
                name="endDate"
                required
                type="date"
              />
            </div>
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              disabled={saving}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? "Saving…" : sprint ? "Save changes" : "Create sprint"}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

function SprintStatusBadge({ status }: { status: Sprint["status"] }) {
  const styles = {
    planned: "bg-muted text-muted-foreground",
    active: "bg-primary/10 text-primary",
    completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <span
      className={`rounded-full px-2 py-1 text-[11px] font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/35 rounded-md border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function getProgress(tasks: TaskBoardItem[]) {
  const completed = tasks.filter((task) => task.status === "done").length;
  return {
    completed,
    percent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
  };
}

function formatDateRange(startDate: string, endDate: string) {
  const format = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  const first = format(startDate);
  const last = format(endDate);
  const year = new Date(`${endDate}T00:00:00`).getFullYear();
  return `${first} – ${last}, ${year}`;
}
