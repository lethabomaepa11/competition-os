import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function client(request: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = client(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const teamId = request.nextUrl.searchParams.get("teamId");
    if (!teamId) return NextResponse.json({ error: "Team is required" }, { status: 400 });
    const { data: team } = await supabase.from("teams").select("id,member_ids").eq("id", teamId).maybeSingle();
    if (!team || team.member_ids[0] !== user.id) return NextResponse.json({ error: "Only the captain can view team invites" }, { status: 403 });
    const { data, error } = await (supabase.from("team_invites" as never) as any).select("id,email,status,expires_at,created_at,token").eq("team_id", teamId).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map((invite: Record<string, unknown>) => ({ id: invite.id, email: invite.email, status: invite.status, expiresAt: invite.expires_at, createdAt: invite.created_at, shareUrl: `${request.nextUrl.origin}/invite/team/${invite.token}` })) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load invites" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = client(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { teamId, email } = await request.json() as { teamId?: string; email?: string };
    if (!teamId) return NextResponse.json({ error: "Team is required" }, { status: 400 });
    const { data: team } = await supabase.from("teams").select("id,name,member_ids").eq("id", teamId).maybeSingle();
    if (!team || team.member_ids[0] !== user.id) return NextResponse.json({ error: "Only the captain can invite players" }, { status: 403 });
    const normalizedEmail = email?.trim().toLowerCase() || null;
    if (normalizedEmail && !/^\S+@\S+\.\S+$/.test(normalizedEmail)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    const { data: invite, error } = await (supabase.from("team_invites" as never) as any).insert({ team_id: teamId, email: normalizedEmail, invited_by: user.id }).select("id,email,status,expires_at,created_at,token").single();
    if (error) throw error;
    const shareUrl = `${request.nextUrl.origin}/invite/team/${invite.token}`;
    if (normalizedEmail) {
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      void fetch(`${request.nextUrl.origin}/api/mail`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "team_invite", to: [{ email: normalizedEmail }], actionUrl: shareUrl, params: { inviterName: profile?.display_name ?? user.email ?? "A team captain", teamName: team.name, actionLabel: "Join team" } }) }).catch(() => undefined);
    }
    return NextResponse.json({ data: { id: invite.id, email: invite.email, status: invite.status, expiresAt: invite.expires_at, createdAt: invite.created_at, shareUrl } }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create invite" }, { status: 500 }); }
}
