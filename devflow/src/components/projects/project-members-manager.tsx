"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialogButton } from "@/components/shared/confirm-dialog-button";

export type ProjectMember = {
  id: string;
  user_id: string;
  role: "owner" | "developer" | "viewer";
  joined_at: string;
  profile: { id: string; email: string; full_name: string | null } | null;
};

export function ProjectMembersManager({
  projectId,
  initialMembers,
  canManage,
}: {
  projectId: string;
  initialMembers: ProjectMember[];
  canManage: boolean;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"developer" | "viewer">("developer");
  const [isAdding, setIsAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsAdding(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message ?? "Could not add this member.");
        return;
      }
      const member = {
        ...result.data,
        profile: { email: result.data.email, full_name: result.data.full_name },
      } as ProjectMember;
      setMembers((current) => [...current, member]);
      setEmail("");
      setNotice("Member added to the project.");
    } catch {
      setError("We couldn’t reach DevFlow. Check your connection and try again.");
    } finally {
      setIsAdding(false);
    }
  }

  async function updateRole(memberId: string, nextRole: "developer" | "viewer") {
    setError(null);
    setNotice(null);
    setUpdatingId(memberId);
    try {
      const response = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message ?? "Could not update this role.");
        return;
      }
      setMembers((current) => current.map((member) => member.id === memberId ? { ...member, role: nextRole } : member));
      setNotice("Member role updated.");
    } catch {
      setError("We couldn’t reach DevFlow. Check your connection and try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function removeMember(memberId: string) {
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/members/${memberId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) return result.error?.message ?? "Could not remove this member.";
      setMembers((current) => current.filter((member) => member.id !== memberId));
      setNotice("Member removed from the project.");
      return null;
    } catch {
      return "We couldn’t reach DevFlow. Check your connection and try again.";
    }
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <section className="rounded-lg border bg-card p-5 sm:p-6">
          <h2 className="font-semibold">Add a project member</h2>
          <p className="text-muted-foreground mt-1 text-sm">They need an existing DevFlow account. You can choose their project role here.</p>
          <form className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_11rem_auto] md:items-end" onSubmit={addMember}>
            <div className="space-y-2">
              <Label htmlFor="member-email">Email address</Label>
              <Input autoComplete="email" id="member-email" onChange={(event) => setEmail(event.target.value)} placeholder="teammate@example.com" required type="email" value={email} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Project role</Label>
              <select className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2" id="member-role" onChange={(event) => setRole(event.target.value as "developer" | "viewer")} value={role}>
                <option value="developer">Developer</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <Button disabled={isAdding} type="submit">{isAdding ? "Adding…" : "Add member"}</Button>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Project members</h2>
          <p className="text-muted-foreground mt-1 text-sm">{members.length} {members.length === 1 ? "person" : "people"} have access to this project.</p>
        </div>
        {error ? <p className="text-destructive px-5 pt-4 text-sm" role="alert">{error}</p> : null}
        {notice ? <p className="px-5 pt-4 text-sm text-emerald-700 dark:text-emerald-300" role="status">{notice}</p> : null}
        <ul className="divide-y">
          {members.map((member) => {
            const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
            const displayName = profile?.full_name || profile?.email || "DevFlow member";
            return (
              <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" key={member.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold">{displayName.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    <p className="text-muted-foreground truncate text-xs">{profile?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {canManage && member.role !== "owner" ? (
                    <select
                      aria-label={`Role for ${displayName}`}
                      className="border-input bg-background focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
                      disabled={updatingId === member.id}
                      onChange={(event) => updateRole(member.id, event.target.value as "developer" | "viewer")}
                      value={member.role}
                    >
                      <option value="developer">Developer</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className="rounded-md border px-2.5 py-1 text-xs capitalize">{member.role}</span>
                  )}
                  {canManage && member.role !== "owner" ? (
                    <ConfirmDialogButton
                      confirmLabel="Remove member"
                      description={`Remove ${displayName} from this project? They will lose access to its tasks and activity.`}
                      destructive
                      onConfirm={() => removeMember(member.id)}
                      title="Remove this member?"
                      triggerLabel="Remove"
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {!members.length ? <p className="text-muted-foreground px-5 py-8 text-center text-sm">No members yet.</p> : null}
      </section>
    </div>
  );
}
