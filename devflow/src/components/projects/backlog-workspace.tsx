"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ProjectTaskLabel,
  type TaskBoardItem,
  type TaskPerson,
} from "@/lib/types/task-board";
import type { Sprint } from "@/lib/types";

export function BacklogWorkspace({
  projectId,
  projectName,
  initialTasks,
  sprints,
  labels,
  members,
  canManage,
  loadError,
}: {
  projectId: string;
  projectName: string;
  initialTasks: TaskBoardItem[];
  sprints: Sprint[];
  labels: ProjectTaskLabel[];
  members: TaskPerson[];
  canManage: boolean;
  loadError: boolean;
}) {
  const [tasks, setTasks] = useState(
    initialTasks.filter((task) => !task.sprintId)
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetSprintId, setTargetSprintId] = useState(sprints[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [error, setError] = useState<string | null>(
    loadError
      ? "Some backlog information could not be loaded. Refresh the page to try again."
      : null
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const filteredTasks = useMemo(
    () =>
      tasks
        .filter((task) => {
          const matchesSearch =
            !search ||
            `${task.title} ${task.description ?? ""}`
              .toLocaleLowerCase()
              .includes(search.toLocaleLowerCase());
          const matchesStatus = !statusFilter || task.status === statusFilter;
          const matchesPriority =
            !priorityFilter || task.priority === priorityFilter;
          const matchesAssignee =
            !assigneeFilter ||
            (assigneeFilter === "unassigned"
              ? task.assigneeId === null
              : task.assigneeId === assigneeFilter);
          const matchesLabel =
            !labelFilter ||
            task.labels.some((label) => label.id === labelFilter);
          return (
            matchesSearch &&
            matchesStatus &&
            matchesPriority &&
            matchesAssignee &&
            matchesLabel
          );
        })
        .sort(
          (a, b) =>
            priorityRank(a.priority) - priorityRank(b.priority) ||
            a.createdAt.localeCompare(b.createdAt)
        ),
    [tasks, search, statusFilter, priorityFilter, assigneeFilter, labelFilter]
  );

  function toggleTask(taskId: string) {
    setSelectedIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    );
  }

  function selectVisible() {
    const visibleIds = filteredTasks.map((task) => task.id);
    setSelectedIds((current) => [...new Set([...current, ...visibleIds])]);
  }

  async function addSelectedTasks() {
    if (!targetSprintId || !selectedIds.length) return;
    setIsAdding(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/sprints/${targetSprintId}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskIds: selectedIds }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(
          result.error?.message ?? "Could not add those tasks to the sprint."
        );
        return;
      }
      const sprintName =
        sprints.find((sprint) => sprint.id === targetSprintId)?.name ??
        "the sprint";
      setTasks((current) =>
        current.filter((task) => !selectedIds.includes(task.id))
      );
      setSelectedIds([]);
      setNotice(
        `${result.data.added} ${result.data.added === 1 ? "task" : "tasks"} added to ${sprintName}.`
      );
    } catch {
      setError("We couldn’t reach DevFlow. Try again.");
    } finally {
      setIsAdding(false);
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
              Backlog
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Prioritize unscheduled work and pull tasks into a planned sprint.
            </p>
          </div>
          <Link
            className="hover:bg-accent inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
            href={`/projects/${projectId}/sprints`}
          >
            Manage sprints <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
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
      {notice ? (
        <p className="text-muted-foreground text-sm" role="status">
          {notice}
        </p>
      ) : null}

      <section
        aria-label="Filter backlog"
        className="bg-card grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="relative block lg:col-span-1">
          <span className="sr-only">Search backlog</span>
          <Search
            aria-hidden="true"
            className="text-muted-foreground absolute top-2.5 left-3 size-4"
          />
          <Input
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search backlog"
            type="search"
            value={search}
          />
        </label>
        <FilterSelect
          label="status"
          value={statusFilter}
          onChange={setStatusFilter}
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="priority"
          value={priorityFilter}
          onChange={setPriorityFilter}
        >
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="assignee"
          value={assigneeFilter}
          onChange={setAssigneeFilter}
        >
          <option value="">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName || member.email}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="label"
          value={labelFilter}
          onChange={setLabelFilter}
        >
          <option value="">All labels</option>
          {labels.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </FilterSelect>
      </section>

      {canManage ? (
        <section className="bg-card flex flex-wrap items-center gap-3 rounded-lg border p-3">
          <span className="text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <label className="min-w-48 flex-1 sm:flex-none">
            <span className="sr-only">Choose sprint</span>
            <select
              aria-label="Choose sprint"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              disabled={!sprints.length}
              onChange={(event) => setTargetSprintId(event.target.value)}
              value={targetSprintId}
            >
              {sprints.length ? (
                sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                    {sprint.status === "active" ? " · Active" : ""}
                  </option>
                ))
              ) : (
                <option value="">No planned sprints</option>
              )}
            </select>
          </label>
          <Button
            disabled={!selectedIds.length || !targetSprintId || isAdding}
            onClick={() => void addSelectedTasks()}
            type="button"
          >
            {isAdding ? "Adding…" : "Add to sprint"}
          </Button>
          {!sprints.length ? (
            <Link
              className="text-primary text-sm hover:underline"
              href={`/projects/${projectId}/sprints`}
            >
              Create a sprint first
            </Link>
          ) : null}
          <Button
            className="ml-auto"
            disabled={!filteredTasks.length}
            onClick={selectVisible}
            type="button"
            variant="ghost"
          >
            Select visible
          </Button>
        </section>
      ) : null}

      {filteredTasks.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                {canManage ? (
                  <th className="w-10 px-4 py-3">
                    <span className="sr-only">Select</span>
                  </th>
                ) : null}
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">Labels</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredTasks.map((task) => (
                <tr
                  className={`hover:bg-muted/30 transition-colors ${selectedIds.includes(task.id) ? "bg-accent/30" : ""}`}
                  key={task.id}
                >
                  {canManage ? (
                    <td className="px-4 py-3">
                      <input
                        aria-label={`Select ${task.title}`}
                        checked={selectedIds.includes(task.id)}
                        className="accent-primary size-4"
                        onChange={() => toggleTask(task.id)}
                        type="checkbox"
                      />
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <p className="font-medium">{task.title}</p>
                    {task.description ? (
                      <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                        {task.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border px-2 py-1 text-xs">
                      {
                        TASK_STATUSES.find((item) => item.value === task.status)
                          ?.label
                      }
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium capitalize">
                      {task.priority}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {task.assignee?.fullName ||
                      task.assignee?.email ||
                      "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {task.labels.map((label) => (
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="bg-card flex min-h-64 flex-col items-center justify-center rounded-lg border px-6 text-center">
          <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-full">
            <Filter aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 font-semibold">
            {tasks.length ? "No matching tasks" : "Your backlog is clear"}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            {tasks.length
              ? "Try changing or clearing your filters."
              : "All project tasks are already planned into a sprint. New tasks without a sprint will appear here."}
          </p>
          {!tasks.length ? (
            <Link
              className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline"
              href={`/projects/${projectId}/board`}
            >
              View task board{" "}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </section>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="sr-only">Filter by {label}</span>
      <select
        aria-label={`Filter by ${label}`}
        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

function priorityRank(priority: TaskBoardItem["priority"]) {
  return { urgent: 0, high: 1, medium: 2, low: 3 }[priority];
}
