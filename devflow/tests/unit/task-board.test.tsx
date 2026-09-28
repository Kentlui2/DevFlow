import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskBoard } from "@/components/tasks/task-board";
import type { TaskBoardItem } from "@/lib/types/task-board";

const task: TaskBoardItem = {
  id: "task-123456",
  projectId: "project-1",
  title: "Ship the roadmap",
  description: null,
  status: "backlog",
  priority: "medium",
  assigneeId: null,
  createdBy: "user-1",
  dueDate: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  assignee: null,
  labels: [],
};

function renderBoard(initialTasks: TaskBoardItem[] = []) {
  return render(
    <TaskBoard
      canEdit
      currentUserId="user-1"
      initialLabels={[]}
      initialTasks={initialTasks}
      loadError={false}
      members={[]}
      projectId="project-1"
      projectName="DevFlow"
      sprints={[]}
    />
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("task board", () => {
  it("creates a task and adds it to the board", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: task }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: task.title },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Create task" }).at(-1)!
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/tasks",
      expect.objectContaining({ method: "POST" })
    );
    expect(await screen.findByText(task.title)).toBeVisible();
    expect(dialog).not.toBeVisible();
  });

  it("moves a task to another status and persists the change", async () => {
    const movedTask = { ...task, status: "in_progress" as const };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: movedTask }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderBoard([task]);
    fireEvent.change(
      screen.getByLabelText(`Move ${task.title} to another status`),
      { target: { value: "in_progress" } }
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/project-1/tasks/${task.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "in_progress" }),
      })
    );
    expect(
      screen.getByRole("region", { name: "In progress, 1 task" })
    ).toContainElement(screen.getByText(task.title));
  });
});
