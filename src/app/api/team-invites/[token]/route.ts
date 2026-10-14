import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function client(request: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { data, error } = await (client(request).rpc as any)("get_team_invite", { invite_token: token });
    if (error) throw error;
    const invite = data?.[0];
    if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    return NextResponse.json({ data: { teamName: invite.team_name, category: invite.category, teamType: invite.team_type, status: invite.status, expiresAt: invite.expires_at } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load invite" }, { status: 500 }); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const supabase = client(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to accept this invite" }, { status: 401 });
    const { data, error } = await (supabase.rpc as any)("accept_team_invite", { invite_token: token });
    if (error) throw error;
    return NextResponse.json({ data: { teamId: data } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not accept invite" }, { status: 500 }); }
}
