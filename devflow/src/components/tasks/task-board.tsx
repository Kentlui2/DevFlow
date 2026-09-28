"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Plus, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Sprint } from "@/lib/types";
import { TaskEditorDialog } from "@/components/tasks/task-editor-dialog";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ProjectTaskLabel,
  type TaskBoardItem,
  type TaskPerson,
} from "@/lib/types/task-board";

type EditorState = {
  task: TaskBoardItem | null;
  status: TaskBoardItem["status"];
};

export function TaskBoard({
  projectId,
  projectName,
  currentUserId,
  initialTasks,
  initialLabels,
  members,
  sprints,
  canEdit,
  loadError,
}: {
  projectId: string;
  projectName: string;
  currentUserId: string;
  initialTasks: TaskBoardItem[];
  initialLabels: ProjectTaskLabel[];
  members: TaskPerson[];
  sprints: Pick<Sprint, "id" | "name" | "status">[];
  canEdit: boolean;
  loadError: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [labels, setLabels] = useState(initialLabels);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [sprintFilter, setSprintFilter] = useState("");
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTasks(initialTasks);
      setLabels(initialLabels);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialTasks, initialLabels]);
  const [error, setError] = useState<string | null>(
    loadError
      ? "Some board information could not be loaded. Refresh the page to try again."
      : null
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const searchMatch =
          !search ||
          `${task.title} ${task.description ?? ""}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase());
        const priorityMatch =
          !priorityFilter || task.priority === priorityFilter;
        const assigneeMatch =
          !assigneeFilter ||
          (assigneeFilter === "unassigned"
            ? task.assigneeId === null
            : task.assigneeId === assigneeFilter);
        const labelMatch =
          !labelFilter || task.labels.some((label) => label.id === labelFilter);
        const sprintMatch =
          !sprintFilter ||
          (sprintFilter === "unassigned"
            ? !task.sprintId
            : task.sprintId === sprintFilter);
        return (
          searchMatch &&
          priorityMatch &&
          assigneeMatch &&
          labelMatch &&
          sprintMatch
        );
      }),
    [tasks, search, priorityFilter, assigneeFilter, labelFilter, sprintFilter]
  );

  function saveTask(saved: TaskBoardItem) {
    setTasks((current) => {
      const exists = current.some((task) => task.id === saved.id);
      return exists
        ? current.map((task) =>
            task.id === saved.id
              ? { ...saved, sprintId: task.sprintId ?? null }
              : task
          )
        : [{ ...saved, sprintId: null }, ...current];
    });
    setError(null);
    setNotice("Task saved.");
  }

  async function moveTask(taskId: string, status: TaskBoardItem["status"]) {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (
      !currentTask ||
      currentTask.status === status ||
      !canEdit ||
      updatingTaskId !== null
    )
      return;
    const previousTasks = tasks;
    setError(null);
    setNotice(null);
    setUpdatingTaskId(taskId);
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, status } : task))
    );
    try {
      const response = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setTasks(previousTasks);
        setError(
          result.error?.message ??
            "Could not move the task. Its original status has been restored."
        );
        return;
      }
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? {
                ...(result.data as TaskBoardItem),
                sprintId: task.sprintId ?? null,
              }
            : task
        )
      );
      setNotice(
        `Moved to ${TASK_STATUSES.find((item) => item.value === status)?.label ?? status}.`
      );
    } catch {
      setTasks(previousTasks);
      setError(
        "We couldn’t reach DevFlow. The task’s original status has been restored."
      );
    } finally {
      setUpdatingTaskId(null);
      setDraggedTaskId(null);
    }
  }

  async function deleteTask(taskId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (!response.ok)
        return result.error?.message ?? "Could not delete the task.";
      setTasks((current) => current.filter((task) => task.id !== taskId));
      setEditor(null);
      setError(null);
      setNotice("Task deleted.");
      return null;
    } catch {
      return "We couldn’t reach DevFlow. Check your connection and try again.";
    }
  }

  function addLabel(label: ProjectTaskLabel) {
    setLabels((current) =>
      current.some((item) => item.id === label.id)
        ? current
        : [...current, label].sort((a, b) => a.name.localeCompare(b.name))
    );
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
              Board
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Move work forward and see what your team is working on.
            </p>
          </div>
          {canEdit ? (
            <Button
              onClick={() => setEditor({ task: null, status: "backlog" })}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" /> Create task
            </Button>
          ) : null}
        </div>
      </header>

      <section
        aria-label="Filter tasks"
        className="bg-card grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1.6fr)_repeat(4,minmax(10rem,1fr))]"
      >
        <label className="relative block">
          <span className="sr-only">Search tasks</span>
          <Search
            aria-hidden="true"
            className="text-muted-foreground absolute top-2.5 left-3 size-4"
          />
          <Input
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks"
            type="search"
            value={search}
          />
        </label>
        <label className="flex items-center gap-2">
          <Filter
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0 lg:hidden"
          />
          <span className="sr-only">Filter by priority</span>
          <select
            aria-label="Filter by priority"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            onChange={(event) => setPriorityFilter(event.target.value)}
            value={priorityFilter}
          >
            <option value="">All priorities</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by assignee</span>
          <select
            aria-label="Filter by assignee"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            onChange={(event) => setAssigneeFilter(event.target.value)}
            value={assigneeFilter}
          >
            <option value="">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName || member.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by label</span>
          <select
            aria-label="Filter by label"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            onChange={(event) => setLabelFilter(event.target.value)}
            value={labelFilter}
          >
            <option value="">All labels</option>
            {labels.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by sprint</span>
          <select
            aria-label="Filter by sprint"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            onChange={(event) => setSprintFilter(event.target.value)}
            value={sprintFilter}
          >
            <option value="">All sprint assignments</option>
            <option value="unassigned">Backlog · no sprint</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name} · {sprint.status}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? (
        <p
          className="text-destructive border-destructive/30 bg-destructive/5 rounded-md border px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-muted-foreground text-sm" role="status">
          {notice}
        </p>
      ) : null}

      <section aria-label="Kanban board" className="overflow-x-auto pb-3">
        <div className="grid w-max min-w-full auto-cols-[minmax(16rem,1fr)] grid-flow-col gap-3 xl:w-full xl:auto-cols-fr">
          {TASK_STATUSES.map((status) => {
            const columnTasks = filteredTasks.filter(
              (task) => task.status === status.value
            );
            return (
              <section
                aria-label={`${status.label}, ${columnTasks.length} ${columnTasks.length === 1 ? "task" : "tasks"}`}
                className={`bg-muted/35 flex min-h-[28rem] flex-col rounded-lg border p-3 transition-colors ${draggedTaskId ? "border-dashed" : ""}`}
                key={status.value}
                onDragOver={(event) => {
                  if (canEdit) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const taskId = event.dataTransfer.getData("text/plain");
                  if (taskId) void moveTask(taskId, status.value);
                }}
              >
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                  <h2 className="text-xs font-semibold tracking-wide uppercase">
                    {status.label}
                  </h2>
                  <span className="text-muted-foreground bg-background rounded-full px-2 py-0.5 text-xs tabular-nums">
                    {columnTasks.length}
                  </span>
                </div>
                <ul className="flex flex-1 flex-col gap-2.5">
                  {columnTasks.map((task) => (
                    <li className="list-none" key={task.id}>
                      <article
                        className={`bg-card rounded-md border shadow-sm transition-shadow hover:shadow-md ${draggedTaskId === task.id ? "opacity-50" : ""}`}
                        draggable={canEdit && updatingTaskId !== task.id}
                        onDragEnd={() => setDraggedTaskId(null)}
                        onDragStart={(event) => {
                          setDraggedTaskId(task.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", task.id);
                        }}
                      >
                        <button
                          className="focus-visible:ring-ring block w-full rounded-t-md p-3 text-left outline-none focus-visible:ring-2"
                          onClick={() =>
                            setEditor({ task, status: task.status })
                          }
                          type="button"
                        >
                          <span className="text-muted-foreground flex items-center justify-between gap-2 text-[11px]">
                            <span>#{task.id.slice(0, 6).toUpperCase()}</span>
                            <span
                              className={`rounded px-1.5 py-0.5 font-medium uppercase ${priorityTone(task.priority)}`}
                            >
                              {task.priority}
                            </span>
                          </span>
                          <span className="mt-2 line-clamp-2 block text-sm leading-5 font-medium">
                            {task.title}
                          </span>
                          {task.labels.length ? (
                            <span className="mt-2 flex flex-wrap gap-1.5">
                              {task.labels.slice(0, 3).map((label) => (
                                <span
                                  className="rounded border px-1.5 py-0.5 text-[10px]"
                                  key={label.id}
                                  style={{
                                    borderColor: label.color,
                                    color: label.color,
                                  }}
                                >
                                  {label.name}
                                </span>
                              ))}
                              {task.labels.length > 3 ? (
                                <span className="text-muted-foreground px-1 py-0.5 text-[10px]">
                                  +{task.labels.length - 3}
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                          <span className="text-muted-foreground mt-3 flex items-center justify-between gap-2 text-xs">
                            <span className="truncate">
                              {task.assignee
                                ? task.assignee.fullName || task.assignee.email
                                : "Unassigned"}
                            </span>
                            {task.dueDate ? (
                              <time
                                className={
                                  isOverdue(task.dueDate, task.status)
                                    ? "text-destructive font-medium"
                                    : ""
                                }
                                dateTime={task.dueDate}
                              >
                                {formatDate(task.dueDate)}
                              </time>
                            ) : null}
                          </span>
                        </button>
                        <div className="border-t px-3 py-2">
                          <label className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground text-[11px]">
                              Move to
                            </span>
                            <select
                              aria-label={`Move ${task.title} to another status`}
                              className="focus-visible:ring-ring bg-transparent text-xs outline-none focus-visible:ring-2"
                              disabled={!canEdit || updatingTaskId === task.id}
                              onChange={(event) =>
                                void moveTask(
                                  task.id,
                                  event.target.value as TaskBoardItem["status"]
                                )
                              }
                              value={task.status}
                            >
                              {TASK_STATUSES.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
                {!columnTasks.length ? (
                  <p className="text-muted-foreground px-1 py-6 text-center text-xs">
                    {tasks.length ? "No matching tasks" : "No tasks yet"}
                  </p>
                ) : null}
                {canEdit ? (
                  <Button
                    className="text-muted-foreground mt-3 w-full justify-start"
                    onClick={() =>
                      setEditor({ task: null, status: status.value })
                    }
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Plus aria-hidden="true" className="size-4" /> Add task
                  </Button>
                ) : null}
              </section>
            );
          })}
        </div>
      </section>

      {editor ? (
        <TaskEditorDialog
          canEdit={canEdit}
          initialStatus={editor.status}
          currentUserId={currentUserId}
          key={editor.task?.id ?? `new-${editor.status}`}
          labels={labels}
          members={members}
          onClose={() => setEditor(null)}
          onDeleted={deleteTask}
          onLabelCreated={addLabel}
          onSaved={saveTask}
          projectId={projectId}
          task={editor.task}
        />
      ) : null}
    </div>
  );
}

function priorityTone(priority: TaskBoardItem["priority"]) {
  return {
    urgent: "bg-destructive/10 text-destructive",
    high: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    medium: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    low: "bg-muted text-muted-foreground",
  }[priority];
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function isOverdue(value: string, status: TaskBoardItem["status"]) {
  if (status === "done") return false;
  const due = new Date(`${value}T23:59:59`);
  return due.getTime() < Date.now();
}
