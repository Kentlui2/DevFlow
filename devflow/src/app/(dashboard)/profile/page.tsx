import { CircleUserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = typeof user?.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : "Your profile";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-muted-foreground text-sm">Workspace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-2 text-sm">Your account details.</p>
      </header>
      <section className="max-w-2xl rounded-lg border bg-card p-6">
        <div className="flex items-center gap-4 border-b pb-6">
          <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full">
            <CircleUserRound aria-hidden="true" className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{name}</h2>
            <p className="text-muted-foreground mt-1 truncate text-sm">{user?.email}</p>
          </div>
        </div>
        <dl className="grid gap-5 pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs font-medium">Full name</dt>
            <dd className="mt-1 text-sm">{name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium">Email address</dt>
            <dd className="mt-1 break-all text-sm">{user?.email}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground mt-6 border-t pt-4 text-xs leading-5">
          Profile editing will be added with account settings.
        </p>
      </section>
    </div>
  );
}
