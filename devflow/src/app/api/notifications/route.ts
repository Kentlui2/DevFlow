import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/http/api-response";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const { data, error } = await supabase.from("notifications")
    .select("id, project_id, actor_id, event_type, entity_type, entity_id, title, body, read_at, created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  if (error) return apiError("Could not load notifications", "INTERNAL_ERROR", 500);
  return NextResponse.json({ data: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError("Not authenticated", "UNAUTHENTICATED", 401);
  const body: unknown = await request.json().catch(() => null);
  const ids = typeof body === "object" && body !== null && "ids" in body && Array.isArray(body.ids)
    ? body.ids.filter((value): value is string => typeof value === "string").slice(0, 100)
    : [];
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id).is("read_at", null);
  if (ids.length) query = query.in("id", ids);
  const { error } = await query;
  if (error) return apiError("Could not update notifications", "INTERNAL_ERROR", 500);
  return NextResponse.json({ data: { updated: true } });
}
