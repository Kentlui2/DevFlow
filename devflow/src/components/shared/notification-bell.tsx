"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function NotificationBell({ userId }: { userId: string }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const load = async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
      if (active) setUnread(count ?? 0);
    };
    void load();
    const channel = supabase.channel(`notifications:${userId}`).on("postgres_changes", {
      event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}`,
    }, () => void load()).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [userId]);
  return <Link aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="text-muted-foreground hover:bg-accent hover:text-foreground relative grid size-9 place-items-center rounded-md" href="/notifications">
    <Bell aria-hidden="true" className="size-4" />
    {unread > 0 ? <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 grid min-h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] leading-none">{unread > 99 ? "99+" : unread}</span> : null}
  </Link>;
}
