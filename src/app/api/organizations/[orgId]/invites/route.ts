import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { deliverMail } from "@/lib/mail/send";
import type { Role } from "@/domain/types";

function client(request: NextRequest) {
  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => request.cookies.getAll(), setAll() {} },
  });
}

async function authorize(request: NextRequest, orgId: string) {
  const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in to manage organization invitations" }, { status: 401 }) };
  const { data: membership } = await (supabase.from("organization_members") as any).select("role").eq("organization_id", orgId).eq("member_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { response: NextResponse.json({ error: "Only organization owners and admins can manage invitations" }, { status: 403 }) };
  }
  return { supabase, user };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await authorize(request, orgId);
  if ("response" in auth) return auth.response;
  const { data, error } = await (auth.supabase.from("invites") as any).select("id,organization_id,email,role,token,status,invited_by,created_at,accepted_at").eq("organization_id", orgId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load organization invitations" }, { status: 500 });
  return NextResponse.json({ data: (data ?? []).map((invite: Record<string, unknown>) => ({ id: invite.id, organizationId: invite.organization_id, email: invite.email, role: invite.role, token: invite.token, status: invite.status, invitedBy: invite.invited_by, createdAt: invite.created_at, acceptedAt: invite.accepted_at })) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await authorize(request, orgId);
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json() as { email?: string; displayName?: string; role?: string };
    const email = body.email?.trim().toLowerCase();
    const displayName = body.displayName?.trim();
    const allowedRoles = new Set(["admin", "moderator", "referee", "member"]);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    if (!allowedRoles.has(body.role ?? "")) return NextResponse.json({ error: "Choose a valid organization role" }, { status: 400 });

    const { data: organization } = await (auth.supabase.from("organizations") as any).select("id,name,slug").eq("id", orgId).maybeSingle();
    if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const { data: existingProfile } = await (auth.supabase.from("profiles") as any).select("id").ilike("email", email).maybeSingle();
    if (existingProfile) {
      const { data: existingMembership } = await (auth.supabase.from("organization_members") as any).select("id").eq("organization_id", orgId).eq("member_id", existingProfile.id).maybeSingle();
      if (existingMembership) return NextResponse.json({ error: "This person is already a member of the organization" }, { status: 409 });
    }
    const { data: pending } = await (auth.supabase.from("invites") as any).select("id").eq("organization_id", orgId).eq("email", email).eq("status", "pending").maybeSingle();
    if (pending) return NextResponse.json({ error: "There is already a pending invitation for this email" }, { status: 409 });

    const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
    const { data: invite, error } = await (auth.supabase.from("invites") as any).insert({ organization_id: orgId, email, role: body.role, token, status: "pending", invited_by: auth.user.id }).select("id,organization_id,email,role,token,status,invited_by,created_at,accepted_at").single();
    if (error) throw error;

    const actionUrl = `${request.nextUrl.origin}/invite/${token}`;
    const { data: inviter } = await (auth.supabase.from("profiles") as any).select("display_name").eq("id", auth.user.id).maybeSingle();
    const mail = await deliverMail({
      kind: "organization_invite",
      to: [{ email, name: displayName }],
      actionUrl,
      params: { organizationName: organization.name, organizationSlug: organization.slug, role: body.role as Role, inviterName: inviter?.display_name ?? auth.user.email ?? "Your organization team", actionLabel: "Review invitation" },
    }).catch(() => ({ ok: false as const, status: 502, error: "Invitation email could not be sent" }));

    return NextResponse.json({ data: { id: invite.id, organizationId: invite.organization_id, email: invite.email, role: invite.role, token: invite.token, status: invite.status, invitedBy: invite.invited_by, createdAt: invite.created_at, acceptedAt: invite.accepted_at, shareUrl: actionUrl, emailSent: mail.ok } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create invitation" }, { status: 500 });
  }
}
