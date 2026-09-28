"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialogButton } from "@/components/shared/confirm-dialog-button";
import { CommentThread } from "@/components/shared/comment-thread";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { TaskGithubLinks } from "@/components/tasks/task-github-links";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ProjectTaskLabel,
  type TaskBoardItem,
  type TaskPerson,
} from "@/lib/types/task-board";

export function TaskEditorDialog({
  projectId,
  task,
  initialStatus,
  currentUserId,
  canEdit,
  members,
  labels,
  onClose,
  onSaved,
  onDeleted,
  onLabelCreated,
}: {
  projectId: string;
  task: TaskBoardItem | null;
  initialStatus: TaskBoardItem["status"];
  currentUserId: string;
  canEdit: boolean;
  members: TaskPerson[];
  labels: ProjectTaskLabel[];
  onClose: () => void;
  onSaved: (task: TaskBoardItem) => void;
  onDeleted: (taskId: string) => Promise<string | null>;
  onLabelCreated: (label: ProjectTaskLabel) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    task?.labels.map((label) => label.id) ?? []
  );
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#315b5a");
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const creating = task === null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const values = new FormData(event.currentTarget);
    const body = {
      title: String(values.get("title") ?? "").trim(),
      description: String(values.get("description") ?? "").trim() || null,
      status: String(values.get("status") ?? initialStatus),
      priority: String(values.get("priority") ?? "medium"),
      assigneeId: String(values.get("assigneeId") ?? "") || null,
      dueDate: String(values.get("dueDate") ?? "") || null,
      labelIds: selectedLabels,
    };

    try {
      const response = await fetch(
        creating
          ? `/api/projects/${projectId}/tasks`
          : `/api/projects/${projectId}/tasks/${task.id}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(
          result.error?.message ?? "Could not save the task. Try again."
        );
        return;
      }
      onSaved(result.data as TaskBoardItem);
      onClose();
    } catch {
      setError(
        "We couldn’t reach DevFlow. Check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createLabel() {
    const name = newLabelName.trim();
    if (!name) return;
    setError(null);
    setIsCreatingLabel(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newLabelColor }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message ?? "Could not create this label.");
        return;
      }
      const label = result.data as ProjectTaskLabel;
      onLabelCreated(label);
      setSelectedLabels((current) => [...current, label.id]);
      setNewLabelName("");
      setShowNewLabel(false);
    } catch {
      setError(
        "We couldn’t reach DevFlow. Check your connection and try again."
      );
    } finally {
      setIsCreatingLabel(false);
    }
  }

  const heading = creating
    ? "Create task"
    : `Task ${task.id.slice(0, 6).toUpperCase()}`;

  return (
    <dialog
      aria-labelledby={titleId}
      className="bg-background text-foreground m-auto max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border p-0 shadow-xl backdrop:bg-black/40"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={dialogRef}
    >
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {creating ? "New work item" : heading}
            </p>
            <h2 className="mt-1 text-xl font-semibold" id={titleId}>
              {creating ? "Create task" : task.title}
            </h2>
          </div>
          <Button
            aria-label="Close task details"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            ×
          </Button>
        </div>

        <form id="task-editor-form" className="mt-6" onSubmit={submit}>
          <fieldset className="space-y-5" disabled={!canEdit || isSubmitting}>
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                autoFocus
                id="task-title"
                maxLength={200}
                name="title"
                defaultValue={task?.title ?? ""}
                placeholder="What needs to be done?"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                maxLength={5000}
                name="description"
                defaultValue={task?.description ?? ""}
                placeholder="Add useful details for your team…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-status">Status</Label>
                <select
                  className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
                  defaultValue={task?.status ?? initialStatus}
                  id="task-status"
                  name="status"
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <select
                  className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
                  defaultValue={task?.priority ?? "medium"}
                  id="task-priority"
                  name="priority"
                >
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-assignee">Assignee</Label>
                <select
                  className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
                  defaultValue={task?.assigneeId ?? ""}
                  id="task-assignee"
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
              <div className="space-y-2">
                <Label htmlFor="task-due-date">Due date</Label>
                <Input
                  id="task-due-date"
                  name="dueDate"
                  type="date"
                  defaultValue={task?.dueDate ?? ""}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Labels</Label>
                {canEdit ? (
                  <Button
                    onClick={() => setShowNewLabel((visible) => !visible)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {showNewLabel ? "Cancel" : "New label"}
                  </Button>
                ) : null}
              </div>
              {labels.length ? (
                <div className="flex flex-wrap gap-2">
                  {labels.map((label) => {
                    const selected = selectedLabels.includes(label.id);
                    return (
                      <label
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${selected ? "border-foreground/25 bg-accent" : "hover:bg-muted"}`}
                        key={label.id}
                      >
                        <input
                          checked={selected}
                          className="accent-primary"
                          disabled={!canEdit || isSubmitting}
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
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No labels yet.</p>
              )}
              {showNewLabel ? (
                <div className="bg-muted/40 grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_3rem_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-label-name">Label name</Label>
                    <Input
                      autoFocus
                      id="new-label-name"
                      maxLength={32}
                      onChange={(event) => setNewLabelName(event.target.value)}
                      value={newLabelName}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-label-color">Color</Label>
                    <Input
                      aria-label="Label color"
                      className="h-9 w-12 cursor-pointer p-1"
                      id="new-label-color"
                      onChange={(event) => setNewLabelColor(event.target.value)}
                      type="color"
                      value={newLabelColor}
                    />
                  </div>
                  <Button
                    disabled={isCreatingLabel || !newLabelName.trim()}
                    onClick={createLabel}
                    type="button"
                  >
                    {isCreatingLabel ? "Adding…" : "Add label"}
                  </Button>
                </div>
              ) : null}
            </div>
          </fieldset>

          {error ? (
            <p className="text-destructive mt-4 text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        {task ? (
          <>
          <AttachmentsPanel canEdit={canEdit} projectId={projectId} targetId={task.id} targetType="task" />
          <TaskGithubLinks canEdit={canEdit} projectId={projectId} taskId={task.id} />
          <CommentThread
            canComment={canEdit}
            commentableId={task.id}
            commentableType="task"
            currentUserId={currentUserId}
            initialComments={[]}
            projectId={projectId}
          />
          </>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div>
            {!creating && canEdit ? (
              <ConfirmDialogButton
                confirmLabel="Delete task"
                description="This permanently deletes the task and its label links. This action cannot be undone."
                destructive
                onConfirm={() => onDeleted(task.id)}
                title="Delete this task?"
                triggerLabel="Delete task"
              />
            ) : null}
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              {canEdit ? "Cancel" : "Close"}
            </Button>
            {canEdit ? (
              <Button
                disabled={isSubmitting}
                form="task-editor-form"
                type="submit"
              >
                {isSubmitting
                  ? "Saving…"
                  : creating
                    ? "Create task"
                    : "Save changes"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </dialog>
  );
}
