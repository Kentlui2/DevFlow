"use client";

import { useMemo, useRef, useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import { ConfirmDialogButton } from "@/components/shared/confirm-dialog-button";
import { CommentThread } from "@/components/shared/comment-thread";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type ProjectIssue,
} from "@/lib/types/collaboration";
import type { ProjectTaskLabel, TaskPerson } from "@/lib/types/task-board";

export function IssueList({
  projectId,
  projectName,
  currentUserId,
  initialIssues,
  labels,
  members,
  canEdit,
  loadError,
}: {
  projectId: string;
  projectName: string;
  currentUserId: string;
  initialIssues: ProjectIssue[];
  labels: ProjectTaskLabel[];
  members: TaskPerson[];
  canEdit: boolean;
  loadError: boolean;
}) {
  const [issues, setIssues] = useState(initialIssues);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIssues(initialIssues));
    return () => cancelAnimationFrame(frame);
  }, [initialIssues]);
  const [editor, setEditor] = useState<ProjectIssue | null | undefined>(
    undefined
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [error, setError] = useState<string | null>(
    loadError
      ? "Some issue information could not be loaded. Refresh the page to try again."
      : null
  );
  const [notice, setNotice] = useState<string | null>(null);

  const filteredIssues = useMemo(
    () =>
      issues.filter((issue) => {
        const matchesSearch =
          !search ||
          `${issue.title} ${issue.description ?? ""} #${issue.issueNumber}`
            .toLowerCase()
            .includes(search.toLowerCase());
        const matchesStatus = !statusFilter || issue.status === statusFilter;
        const matchesPriority =
          !priorityFilter || issue.priority === priorityFilter;
        const matchesAssignee =
          !assigneeFilter ||
          (assigneeFilter === "unassigned"
            ? issue.assigneeId === null
            : issue.assigneeId === assigneeFilter);
        const matchesLabel =
          !labelFilter ||
          issue.labels.some((label) => label.id === labelFilter);
        return (
          matchesSearch &&
          matchesStatus &&
          matchesPriority &&
          matchesAssignee &&
          matchesLabel
        );
      }),
    [issues, search, statusFilter, priorityFilter, assigneeFilter, labelFilter]
  );

  function saveIssue(saved: ProjectIssue) {
    setIssues((current) =>
      current.some((issue) => issue.id === saved.id)
        ? current.map((issue) => (issue.id === saved.id ? saved : issue))
        : [saved, ...current]
    );
    setEditor(undefined);
    setError(null);
    setNotice(`Issue #${saved.issueNumber} saved.`);
  }

  async function deleteIssue(issueId: string) {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueId}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (!response.ok)
        return result.error?.message ?? "Could not delete the issue.";
      setIssues((current) => current.filter((issue) => issue.id !== issueId));
      setEditor(undefined);
      setNotice("Issue deleted.");
      return null;
    } catch {
      return "We couldn’t reach DevFlow. Try again.";
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
              Issues
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Track bugs and unexpected behavior your team needs to resolve.
            </p>
          </div>
          {canEdit ? (
            <Button onClick={() => setEditor(null)} type="button">
              <Plus aria-hidden="true" className="size-4" /> New issue
            </Button>
          ) : null}
        </div>
      </header>

      <section
        aria-label="Filter issues"
        className="bg-card grid gap-3 rounded-lg border p-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <label className="relative block">
          <span className="sr-only">Search issues</span>
          <Search
            aria-hidden="true"
            className="text-muted-foreground absolute top-2.5 left-3 size-4"
          />
          <Input
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search issues"
            value={search}
          />
        </label>
        <select
          aria-label="Filter by status"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          onChange={(event) => setStatusFilter(event.target.value)}
          value={statusFilter}
        >
          <option value="">All statuses</option>
          {ISSUE_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by priority"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          onChange={(event) => setPriorityFilter(event.target.value)}
          value={priorityFilter}
        >
          <option value="">All priorities</option>
          {ISSUE_PRIORITIES.map((priority) => (
            <option key={priority.value} value={priority.value}>
              {priority.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by assignee"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
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
        <select
          aria-label="Filter by label"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
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
      </section>

      {error ? (
        <p
          className="text-destructive border-destructive/30 bg-destructive/5 rounded-md border px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {notice ? <Toast key={notice} message={notice} /> : null}

      {filteredIssues.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Issue</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">Labels</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredIssues.map((issue) => (
                <tr
                  aria-label={`Open issue #${issue.issueNumber}: ${issue.title}`}
                  className="group hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-ring active:bg-muted/60 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                  key={issue.id}
                  onClick={() => setEditor(issue)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setEditor(issue);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3 text-left">
                      <span>
                        <span className="text-muted-foreground block text-xs">
                          #{issue.issueNumber}
                        </span>
                        <span className="font-medium">{issue.title}</span>
                      </span>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="text-muted-foreground size-4 shrink-0 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
                      />
                    </div>
                    {issue.description ? (
                      <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                        {issue.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-1 text-xs ${statusTone(issue.status)}`}
                    >
                      {
                        ISSUE_STATUSES.find(
                          (item) => item.value === issue.status
                        )?.label
                      }
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium ${priorityTone(issue.priority)}`}
                    >
                      {issue.priority}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {issue.assignee?.fullName ||
                      issue.assignee?.email ||
                      "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {issue.labels.map((label) => (
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
          <h2 className="font-semibold">
            {issues.length ? "No matching issues" : "No issues yet"}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            {issues.length
              ? "Try changing or clearing your filters."
              : "Log a bug or unexpected behavior to give your team a place to track it."}
          </p>
          {!issues.length && canEdit ? (
            <Button
              className="mt-4"
              onClick={() => setEditor(null)}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" /> New issue
            </Button>
          ) : null}
        </section>
      )}

      {editor !== undefined ? (
        <IssueEditorDialog
          canEdit={canEdit}
          currentUserId={currentUserId}
          issue={editor}
          key={editor?.id ?? "new-issue"}
          labels={labels}
          members={members}
          onClose={() => setEditor(undefined)}
          onDeleted={deleteIssue}
          onSaved={saveIssue}
          projectId={projectId}
        />
      ) : null}
    </div>
  );
}

function IssueEditorDialog({
  projectId,
  issue,
  currentUserId,
  canEdit,
  members,
  labels,
  onClose,
  onSaved,
  onDeleted,
}: {
  projectId: string;
  issue: ProjectIssue | null;
  currentUserId: string;
  canEdit: boolean;
  members: TaskPerson[];
  labels: ProjectTaskLabel[];
  onClose: () => void;
  onSaved: (issue: ProjectIssue) => void;
  onDeleted: (issueId: string) => Promise<string | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLabels, setSelectedLabels] = useState(
    issue?.labels.map((label) => label.id) ?? []
  );
  const creating = issue === null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    const values = new FormData(event.currentTarget);
    const body = {
      title: String(values.get("title") ?? "").trim(),
      description: String(values.get("description") ?? "").trim() || null,
      status: String(values.get("status") ?? "open"),
      priority: String(values.get("priority") ?? "medium"),
      assigneeId: String(values.get("assigneeId") ?? "") || null,
      labelIds: selectedLabels,
    };
    try {
      const response = await fetch(
        creating
          ? `/api/projects/${projectId}/issues`
          : `/api/projects/${projectId}/issues/${issue.id}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message ?? "Could not save the issue.");
        return;
      }
      onSaved(result.data as ProjectIssue);
    } catch {
      setError("We couldn’t reach DevFlow. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <dialog
      aria-labelledby="issue-dialog-heading"
      className="bg-background text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 m-auto max-h-[calc(100dvh-2rem)] w-[min(42rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border p-0 shadow-xl backdrop:bg-black/40 motion-safe:duration-200 motion-safe:ease-out"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={dialogRef}
    >
      <div className="p-5 sm:p-7">
        <div>
          <div className="mb-4 flex justify-end">
            <Button
              aria-label="Close issue details"
              onClick={onClose}
              size="icon"
              type="button"
              variant="ghost"
            >
              ×
            </Button>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {creating ? "New issue" : `Issue #${issue.issueNumber}`}
            </p>
            <h2
              className="mt-1 text-xl font-semibold"
              id="issue-dialog-heading"
            >
              {creating ? "Create issue" : issue.title}
            </h2>
          </div>
        </div>
        <form id="issue-editor-form" className="mt-6" onSubmit={submit}>
          <fieldset className="space-y-5" disabled={!canEdit || isSaving}>
            <div className="space-y-2">
              <Label htmlFor="issue-title">Title</Label>
              <Input
                autoFocus
                defaultValue={issue?.title ?? ""}
                id="issue-title"
                maxLength={200}
                name="title"
                placeholder="What went wrong?"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue-description">Description</Label>
              <Textarea
                defaultValue={issue?.description ?? ""}
                id="issue-description"
                maxLength={5000}
                name="description"
                placeholder="Describe what happened and how to reproduce it…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issue-status">Status</Label>
                <select
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue={issue?.status ?? "open"}
                  id="issue-status"
                  name="status"
                >
                  {ISSUE_STATUSES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue-priority">Priority</Label>
                <select
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue={issue?.priority ?? "medium"}
                  id="issue-priority"
                  name="priority"
                >
                  {ISSUE_PRIORITIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="issue-assignee">Assignee</Label>
                <select
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue={issue?.assigneeId ?? ""}
                  id="issue-assignee"
                  name="assigneeId"
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName || member.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Labels</Label>
              {labels.length ? (
                <div className="flex flex-wrap gap-2">
                  {labels.map((label) => (
                    <label
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${selectedLabels.includes(label.id) ? "bg-accent" : "hover:bg-muted"}`}
                      key={label.id}
                    >
                      <input
                        checked={selectedLabels.includes(label.id)}
                        disabled={!canEdit || isSaving}
                        onChange={(event) =>
                          setSelectedLabels((current) =>
                            event.target.checked
                              ? [...current, label.id]
                              : current.filter((id) => id !== label.id)
                          )
                        }
                        type="checkbox"
                      />
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Create labels from a task to reuse them here.
                </p>
              )}
            </div>
          </fieldset>
          {error ? (
            <p className="text-destructive mt-4 text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </form>
        {issue ? (
          <>
            <AttachmentsPanel
              canEdit={canEdit}
              projectId={projectId}
              targetId={issue.id}
              targetType="issue"
            />
            <CommentThread
              canComment={canEdit}
              commentableId={issue.id}
              commentableType="issue"
              currentUserId={currentUserId}
              initialComments={[]}
              projectId={projectId}
            />
          </>
        ) : null}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div>
            {issue && canEdit ? (
              <ConfirmDialogButton
                confirmLabel="Delete issue"
                description="This permanently deletes the issue, its labels, and its comments."
                destructive
                onConfirm={() => onDeleted(issue.id)}
                title="Delete this issue?"
                triggerLabel="Delete issue"
              />
            ) : null}
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              disabled={isSaving}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              {canEdit ? "Cancel" : "Close"}
            </Button>
            {canEdit ? (
              <Button
                disabled={isSaving}
                form="issue-editor-form"
                type="submit"
              >
                {isSaving
                  ? "Saving…"
                  : creating
                    ? "Create issue"
                    : "Save changes"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </dialog>
  );
}

function statusTone(status: ProjectIssue["status"]) {
  return {
    open: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
    in_progress:
      "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    resolved:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    closed: "border-muted-foreground/20 bg-muted text-muted-foreground",
  }[status];
}
function priorityTone(priority: ProjectIssue["priority"]) {
  return {
    urgent: "text-destructive",
    high: "text-orange-700 dark:text-orange-300",
    medium: "text-amber-800 dark:text-amber-300",
    low: "text-muted-foreground",
  }[priority];
}
