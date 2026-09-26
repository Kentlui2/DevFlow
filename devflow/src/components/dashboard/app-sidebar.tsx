"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleUserRound,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMascot } from "@/components/shared/brand-mascot";

type SidebarProject = { id: string; name: string };

export function AppSidebar({ projects }: { projects: SidebarProject[] }) {
  const pathname = usePathname();

  function itemClass(active: boolean) {
    return cn(
      "flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
      active
        ? "bg-accent text-accent-foreground font-medium"
        : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
    );
  }

  const primaryLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
  ];

  const navContent = (
    <>
      <nav aria-label="Main navigation" className="space-y-1">
        {primaryLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link aria-current={active ? "page" : undefined} className={itemClass(active)} href={href} key={href}>
              <Icon aria-hidden="true" className="size-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">
        <div className="mb-2 flex items-center justify-between px-3">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Your projects</h2>
          <FolderKanban aria-hidden="true" className="text-muted-foreground size-4" />
        </div>
        {projects.length ? (
          <nav aria-label="Your projects" className="space-y-1">
            {projects.map((project) => {
              const href = `/projects/${project.id}`;
              const active = pathname.startsWith(href);
              return (
                <Link aria-current={active ? "page" : undefined} className={itemClass(active)} href={href} key={project.id}>
                  <span aria-hidden="true" className="bg-primary/70 size-2 rounded-full" />
                  <span className="truncate">{project.name}</span>
                </Link>
              );
            })}
          </nav>
        ) : (
          <p className="text-muted-foreground px-3 py-2 text-xs leading-5">Projects you belong to will appear here.</p>
        )}
      </div>

      <div className="mt-auto space-y-1 border-t pt-4">
        <Link className={itemClass(pathname === "/settings")} href="/settings">
          <Settings aria-hidden="true" className="size-[18px]" /> Settings
        </Link>
        <Link className={itemClass(pathname === "/profile")} href="/profile">
          <CircleUserRound aria-hidden="true" className="size-[18px]" /> Profile
        </Link>
      </div>
    </>
  );

  return (
    <>
      <aside className="bg-background hidden w-60 shrink-0 border-r md:flex md:flex-col md:px-3 md:py-5">
        <Link className="mb-8 flex items-center gap-2 px-3 font-semibold tracking-tight" href="/dashboard">
          <BrandMascot className="h-7 w-10 object-contain" />
          <span>DevFlow</span>
        </Link>
        {navContent}
      </aside>
      <details className="group relative md:hidden">
        <summary className="text-muted-foreground flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <ClipboardList aria-hidden="true" className="size-4" /> Browse workspace
        </summary>
        <div className="bg-background absolute top-12 left-0 z-30 flex max-h-[75vh] w-[min(20rem,calc(100vw-3rem))] flex-col overflow-y-auto rounded-lg border p-3 shadow-lg">
          {navContent}
        </div>
      </details>
    </>
  );
}
