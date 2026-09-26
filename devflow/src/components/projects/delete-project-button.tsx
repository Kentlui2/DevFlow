"use client";

import { useRouter } from "next/navigation";
import { ConfirmDialogButton } from "@/components/shared/confirm-dialog-button";

export function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter();

  async function deleteProject() {
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) return result.error?.message ?? "Could not delete project.";
      router.replace("/projects");
      return null;
    } catch {
      return "We couldn’t reach DevFlow. Check your connection and try again.";
    }
  }

  return (
    <ConfirmDialogButton
      confirmLabel="Delete project"
      description={`Deleting “${projectName}” permanently removes its tasks and memberships. This action cannot be undone.`}
      destructive
      onConfirm={deleteProject}
      title="Delete this project?"
      triggerLabel="Delete project"
    />
  );
}
