import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: notifications } = await supabase.from("notifications")
    .select("id, project_id, event_type, entity_type, entity_id, title, body, read_at, created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  const unreadIds = (notifications ?? []).filter((item) => !item.read_at).map((item) => item.id);
  if (unreadIds.length) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
  return <section className="mx-auto w-full max-w-3xl space-y-6">
    <header><p className="text-muted-foreground text-sm">Your workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Notifications</h1><p className="text-muted-foreground mt-2 text-sm">Assignments, comments, and sprint updates for your projects.</p></header>
    <div className="divide-y rounded-lg border">
      {(notifications ?? []).length ? (notifications ?? []).map((item) => <Link className="hover:bg-accent/40 block p-4 transition-colors" href={`/projects/${item.project_id}/${item.entity_type === "sprint" ? "sprints" : item.entity_type === "issue" ? "issues" : "board"}`} key={item.id}>
        <p className="font-medium">{item.title}</p><p className="text-muted-foreground mt-1 text-sm">{item.body}</p><time className="text-muted-foreground mt-2 block text-xs" dateTime={item.created_at}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</time>
      </Link>) : <p className="text-muted-foreground p-6 text-sm">You’re all caught up.</p>}
    </div>
  </section>;
}
