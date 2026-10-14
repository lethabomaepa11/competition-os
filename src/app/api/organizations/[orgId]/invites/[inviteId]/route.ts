import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ orgId: string; inviteId: string }> }) {
  const { orgId, inviteId } = await params;
  const supabase = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: membership } = await (supabase.from("organization_members") as any).select("role").eq("organization_id", orgId).eq("member_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) return NextResponse.json({ error: "Only organization owners and admins can revoke invitations" }, { status: 403 });
  const { data, error } = await (supabase.from("invites") as any).update({ status: "revoked" }).eq("id", inviteId).eq("organization_id", orgId).eq("status", "pending").select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not revoke invitation" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Pending invitation not found" }, { status: 404 });
  return NextResponse.json({ data: { revoked: true } });
}
