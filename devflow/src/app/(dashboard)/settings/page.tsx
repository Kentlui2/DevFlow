import Link from "next/link";
import { KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-muted-foreground text-sm">Workspace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2 text-sm">Manage your DevFlow account.</p>
      </header>
      <section className="max-w-3xl space-y-3">
        <article className="flex items-start gap-4 rounded-lg border bg-card p-5">
          <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-md"><MailCheck aria-hidden="true" className="size-[18px]" /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-medium">Email address</h2>
            <p className="text-muted-foreground mt-1 break-all text-sm">{user?.email}</p>
            <p className="text-muted-foreground mt-2 text-xs">Email address editing is not available yet.</p>
          </div>
        </article>
        <article className="flex items-start gap-4 rounded-lg border bg-card p-5">
          <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-md"><KeyRound aria-hidden="true" className="size-[18px]" /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-medium">Password</h2>
            <p className="text-muted-foreground mt-1 text-sm">Change your password using a secure email link.</p>
            <Link className="text-primary mt-2 inline-block text-sm font-medium hover:underline" href="/forgot-password">Send password reset link</Link>
          </div>
        </article>
        <article className="flex items-start gap-4 rounded-lg border bg-card p-5">
          <span className="bg-emerald-50 text-emerald-700 grid size-9 shrink-0 place-items-center rounded-md dark:bg-emerald-950 dark:text-emerald-300"><ShieldCheck aria-hidden="true" className="size-[18px]" /></span>
          <div>
            <h2 className="text-sm font-medium">Account security</h2>
            <p className="text-muted-foreground mt-1 text-sm">Your workspace uses Supabase Auth to manage your session.</p>
          </div>
        </article>
      </section>
    </div>
  );
}
