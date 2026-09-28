"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Download, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Attachment = { id: string; file_name: string; file_size: number; downloadUrl: string | null };
export function AttachmentsPanel({ projectId, targetType, targetId, canEdit }: {
  projectId: string; targetType: "task" | "issue" | "comment"; targetId: string; canEdit: boolean;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${projectId}/attachments?targetType=${targetType}&targetId=${targetId}`)
      .then((r) => r.json()).then((result) => { if (active && Array.isArray(result.data)) setItems(result.data as Attachment[]); })
      .catch(() => { if (active) setError("Could not load attachments."); });
    return () => { active = false; };
  }, [projectId, targetId, targetType]);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true); setError(null);
    const form = new FormData(); form.set("file", file); form.set("targetType", targetType); form.set("targetId", targetId);
    try {
      const response = await fetch(`/api/projects/${projectId}/attachments`, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not upload file.");
      setItems((current) => [...current, result.data as Attachment]);
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Could not upload file."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    const response = await fetch(`/api/projects/${projectId}/attachments/${id}`, { method: "DELETE" });
    if (!response.ok) { setError("Could not remove this attachment."); return; }
    setItems((current) => current.filter((item) => item.id !== id));
  }
  return <section className="mt-4 border-t pt-4" aria-label="Attachments">
    <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-medium"><Paperclip aria-hidden="true" className="size-4" /> Attachments</h3>
      {canEdit ? <label className="text-primary hover:bg-accent inline-flex h-8 cursor-pointer items-center rounded-md px-2 text-xs font-medium">{busy ? "Uploading…" : "Add file"}<input accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/markdown,application/zip,.docx,.xlsx" className="sr-only" disabled={busy} onChange={upload} type="file" /></label> : null}
    </div>
    {items.length ? <ul className="mt-2 space-y-1">{items.map((item) => <li className="flex items-center gap-2 text-sm" key={item.id}>
      <span className="min-w-0 flex-1 truncate">{item.file_name}<span className="text-muted-foreground ml-2 text-xs">{formatSize(item.file_size)}</span></span>
      {item.downloadUrl ? <a aria-label={`Download ${item.file_name}`} className="text-primary p-1" href={item.downloadUrl} rel="noreferrer" target="_blank"><Download className="size-4" /></a> : null}
      {canEdit ? <Button aria-label={`Remove ${item.file_name}`} onClick={() => void remove(item.id)} size="icon" type="button" variant="ghost"><Trash2 className="size-4" /></Button> : null}
    </li>)}</ul> : <p className="text-muted-foreground mt-2 text-xs">No files attached.</p>}
    {error ? <p className="text-destructive mt-2 text-xs" role="alert">{error}</p> : null}
  </section>;
}
function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
