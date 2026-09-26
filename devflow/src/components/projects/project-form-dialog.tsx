"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Project = { id: string; name: string; description: string | null };

export function ProjectFormDialog({ project }: { project?: Project }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(project);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch(editing ? `/api/projects/${project!.id}` : "/api/projects", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(values.get("name")).trim(),
          description: String(values.get("description")).trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message ?? "We couldn’t save this project. Try again.");
        return;
      }

      setIsOpen(false);
      if (!editing && result.data?.id) router.push(`/projects/${result.data.id}`);
      else router.refresh();
    } catch {
      setError("We couldn’t reach DevFlow. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button onClick={() => { setError(null); setIsOpen(true); }} type="button" variant={editing ? "outline" : "default"}>
        {editing ? "Edit project" : "New project"}
      </Button>
      <dialog
        aria-labelledby="project-form-title"
        className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-xl border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
        onCancel={(event) => { event.preventDefault(); setIsOpen(false); }}
        onClose={() => setIsOpen(false)}
        ref={dialogRef}
      >
        <form className="p-6" onSubmit={submit}>
          <h2 className="text-lg font-semibold" id="project-form-title">{editing ? "Edit project" : "Create a project"}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{editing ? "Update the details your team sees." : "Give your team a focused space for development work."}</p>
          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input autoFocus id="project-name" maxLength={80} minLength={2} name="name" defaultValue={project?.name} placeholder="e.g. DevFlow" required />
              <p className="text-muted-foreground text-xs">Use 2–80 characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="project-description" maxLength={500} name="description" defaultValue={project?.description ?? ""} placeholder="What is this project about?" />
              <p className="text-muted-foreground text-xs">Up to 500 characters.</p>
            </div>
          </div>
          {error ? <p className="text-destructive mt-4 text-sm" role="alert">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button disabled={isSubmitting} onClick={() => setIsOpen(false)} type="button" variant="outline">Cancel</Button>
            <Button disabled={isSubmitting} type="submit">{isSubmitting ? "Saving…" : editing ? "Save changes" : "Create project"}</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
