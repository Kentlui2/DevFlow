"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialogButton } from "@/components/shared/confirm-dialog-button";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { createClient } from "@/lib/supabase/client";
import type { ProjectComment } from "@/lib/types/collaboration";

export function CommentThread({
  projectId,
  commentableType,
  commentableId,
  currentUserId,
  canComment,
  initialComments,
}: {
  projectId: string;
  commentableType: ProjectComment["commentableType"];
  commentableId: string;
  currentUserId: string;
  canComment: boolean;
  initialComments: ProjectComment[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(
      `/api/projects/${projectId}/comments?commentableType=${commentableType}&commentableId=${commentableId}`
    )
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error?.message ?? "Could not load comments.");
        if (active) setComments(result.data as ProjectComment[]);
      })
      .catch((loadError: unknown) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load comments."
          );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, commentableType, commentableId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`comments:${commentableId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "comments",
        filter: `commentable_id=eq.${commentableId}`,
      }, () => {
        void fetch(`/api/projects/${projectId}/comments?commentableType=${commentableType}&commentableId=${commentableId}`)
          .then((response) => response.json()).then((result) => {
            if (Array.isArray(result.data)) setComments(result.data as ProjectComment[]);
          });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [projectId, commentableId, commentableType]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentableType, commentableId, body }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message ?? "Could not post the comment.");
        return;
      }
      setComments((current) => [...current, result.data as ProjectComment]);
      setBody("");
    } catch {
      setError("We couldn’t reach DevFlow. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEdit(commentId: string) {
    if (!editingBody.trim()) return "Write a comment before saving.";
    try {
      const response = await fetch(
        `/api/projects/${projectId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: editingBody }),
        }
      );
      const result = await response.json();
      if (!response.ok)
        return result.error?.message ?? "Could not update the comment.";
      setComments((current) =>
        current.map((comment) =>
          comment.id === commentId ? (result.data as ProjectComment) : comment
        )
      );
      setEditingId(null);
      return null;
    } catch {
      return "We couldn’t reach DevFlow. Try again.";
    }
  }

  async function deleteComment(commentId: string) {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/comments/${commentId}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (!response.ok)
        return result.error?.message ?? "Could not delete the comment.";
      setComments((current) =>
        current.filter((comment) => comment.id !== commentId)
      );
      return null;
    } catch {
      return "We couldn’t reach DevFlow. Try again.";
    }
  }

  return (
    <section aria-label="Comments" className="border-t pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Comments</h3>
        <span className="text-muted-foreground text-xs tabular-nums">
          {comments.length}
        </span>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground mt-3 text-sm">Loading comments…</p>
      ) : comments.length ? (
        <ol className="mt-4 space-y-4">
          {comments.map((comment) => {
            const ownComment = comment.authorId === currentUserId;
            return (
              <li className="min-w-0" key={comment.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-medium">
                    {comment.author.fullName || comment.author.email}
                  </span>
                  <time
                    className="text-muted-foreground text-xs"
                    dateTime={comment.createdAt}
                  >
                    {formatCommentDate(comment.createdAt)}
                  </time>
                </div>
                {editingId === comment.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      autoFocus
                      maxLength={5000}
                      onChange={(event) => setEditingBody(event.target.value)}
                      value={editingBody}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => setEditingId(null)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={async () => {
                          setIsSaving(true);
                          setError(await saveEdit(comment.id));
                          setIsSaving(false);
                        }}
                        disabled={isSaving}
                        size="sm"
                        type="button"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground mt-1 text-sm leading-6 break-words whitespace-pre-wrap">
                    {comment.body}
                  </p>
                )}
                {canComment && ownComment && editingId !== comment.id ? (
                  <div className="mt-1 flex gap-1">
                    <Button
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditingBody(comment.body);
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Edit
                    </Button>
                    <ConfirmDialogButton
                      confirmLabel="Delete comment"
                      description="This comment will be permanently removed."
                      destructive
                      onConfirm={() => deleteComment(comment.id)}
                      title="Delete this comment?"
                      triggerLabel="Delete"
                    />
                  </div>
                ) : null}
                <AttachmentsPanel canEdit={canComment} projectId={projectId} targetId={comment.id} targetType="comment" />
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-muted-foreground mt-3 text-sm">
          No comments yet. Start the conversation.
        </p>
      )}
      {canComment ? (
        <form className="mt-4 space-y-2" onSubmit={submit}>
          <label className="sr-only" htmlFor={`comment-${commentableId}`}>
            Write a comment
          </label>
          <Textarea
            id={`comment-${commentableId}`}
            maxLength={5000}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a comment…"
            value={body}
          />
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button disabled={isSaving || !body.trim()} size="sm" type="submit">
              {isSaving ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </form>
      ) : null}
      {error && !canComment ? (
        <p className="text-destructive mt-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
