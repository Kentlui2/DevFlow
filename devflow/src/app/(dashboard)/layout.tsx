import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { BrandMascot } from "@/components/shared/brand-mascot";
import { NotificationBell } from "@/components/shared/notification-bell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id);
  const projectIds = memberships?.map((membership) => membership.project_id) ?? [];
  const { data: projects } = projectIds.length
    ? await supabase.from("projects").select("id, name").in("id", projectIds).order("name")
    : { data: [] };

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  const initials = (fullName || user.email || "D").slice(0, 1).toUpperCase();

  return (
    <div className="bg-muted/30 flex min-h-screen">
      <AppSidebar projects={projects ?? []} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/90 sticky top-0 z-20 flex h-16 items-center justify-between border-b px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMascot className="h-7 w-10 object-contain md:hidden" />
            <span className="font-semibold tracking-tight md:hidden">DevFlow</span>
            <span className="text-muted-foreground hidden text-sm lg:inline">Team workspace</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell userId={user.id} />
            <span className="text-muted-foreground hidden max-w-48 truncate text-sm sm:inline">{user.email}</span>
            <span aria-label={`Signed in as ${user.email}`} className="bg-primary/10 text-primary grid size-8 place-items-center rounded-full text-sm font-semibold">{initials}</span>
            <form action={signOut}>
              <Button aria-label="Sign out" size="icon" type="submit" variant="ghost">
                <LogOut aria-hidden="true" className="size-4" />
              </Button>
            </form>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <div className="bg-background flex w-full min-w-0 flex-1 flex-col md:m-4 md:rounded-xl md:border">
            <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
              <div className="mb-5 md:hidden"><AppSidebar projects={projects ?? []} /></div>
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
