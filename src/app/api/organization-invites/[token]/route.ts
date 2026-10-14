import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";

function client(request: NextRequest) {
  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } });
}

function missingRpc(error: { code?: string; message?: string }) {
  return error.code === "PGRST202" || /could not find the function|function .* does not exist/i.test(error.message ?? "");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = client(request);
  const { data, error } = await (supabase.rpc as any)("get_organization_invite", { invite_token: token });
  let invite = data?.[0];
  if (error && missingRpc(error)) {
    const { data: legacyInvite, error: lookupError } = await (supabase.from("invites") as any).select("organization_id,email,role,status,invited_by").eq("token", token).maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Could not load this invitation" }, { status: 500 });
    if (legacyInvite) {
      const [{ data: organization }, { data: inviter }] = await Promise.all([
        (supabase.from("organizations") as any).select("name,slug").eq("id", legacyInvite.organization_id).maybeSingle(),
        (supabase.from("profiles") as any).select("display_name").eq("id", legacyInvite.invited_by).maybeSingle(),
      ]);
      invite = { organization_id: legacyInvite.organization_id, organization_name: organization?.name, organization_slug: organization?.slug, invite_email: legacyInvite.email, invite_role: legacyInvite.role, invite_status: legacyInvite.status, inviter_name: inviter?.display_name };
    }
  } else if (error) {
    return NextResponse.json({ error: "Could not load this invitation" }, { status: 500 });
  }
  if (!invite) return NextResponse.json({ error: "This invitation could not be found" }, { status: 404 });
  return NextResponse.json({ data: { organizationId: invite.organization_id, organizationName: invite.organization_name, organizationSlug: invite.organization_slug, email: invite.invite_email, role: invite.invite_role, status: invite.invite_status, inviterName: invite.inviter_name } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to accept this invitation" }, { status: 401 });
  const { data, error } = await (supabase.rpc as any)("accept_organization_invite", { invite_token: token });
  if (error && missingRpc(error)) {
    const { data: invite, error: inviteError } = await (supabase.from("invites") as any).select("id,organization_id,email,role,status").eq("token", token).maybeSingle();
    if (inviteError || !invite) return NextResponse.json({ error: "This invitation could not be found" }, { status: 404 });
    if (invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) return NextResponse.json({ error: `Sign in with ${invite.email} to accept this invitation` }, { status: 403 });
    if (invite.status === "accepted") {
      const { data: membership } = await (supabase.from("organization_members") as any).select("id").eq("organization_id", invite.organization_id).eq("member_id", user.id).maybeSingle();
      if (membership) return NextResponse.json({ data: { organizationId: invite.organization_id } });
      return NextResponse.json({ error: "This invitation has already been accepted" }, { status: 409 });
    }
    if (invite.status !== "pending") return NextResponse.json({ error: `This invitation is ${invite.status}` }, { status: 409 });
    const { error: memberError } = await (supabase.from("organization_members") as any).upsert({ organization_id: invite.organization_id, member_id: user.id, role: invite.role }, { onConflict: "organization_id,member_id", ignoreDuplicates: true });
    if (memberError) return NextResponse.json({ error: "Could not add you to this organization" }, { status: 500 });
    const { error: acceptError } = await (supabase.from("invites") as any).update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invite.id).eq("status", "pending");
    if (acceptError) return NextResponse.json({ error: "Membership was added. Reopen this invitation to finish acceptance." }, { status: 500 });
    return NextResponse.json({ data: { organizationId: invite.organization_id } });
  }
  if (error) {
    const detail = error.message ?? "Could not accept this invitation";
    const status = /sign in with/i.test(detail) ? 403 : /could not be found|already been accepted|is revoked|is expired/i.test(detail) ? 409 : 400;
    return NextResponse.json({ error: detail }, { status });
  }
  return NextResponse.json({ data: { organizationId: data } });
}
