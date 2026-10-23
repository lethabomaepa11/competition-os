import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { deliverMail } from "@/lib/mail/send";
import type { MailEventKind, MailEventPayload } from "@/lib/mail/templates";

// Browser-initiated mail is limited to these kinds. Everything else (account
// credentials, team and organization invites, player notifications) is sent
// only by server routes that have already authorized the action.
const SELF_ONLY_KINDS = new Set<MailEventKind>([
  "participant_registered",
  "competition_published",
  "competition_started",
  "competition_completed",
  "competition_archived",
  "competition_invite_created",
]);
const OFFICIAL_KINDS = new Set<MailEventKind>([
  "participant_invite",
  "participant_dropped",
  "event_created",
  "event_completed",
  "event_cancelled",
  "standings_updated",
  "bracket_generated",
]);
const OFFICIAL_ROLES = ["owner", "admin", "moderator", "referee"];
const MAX_RECIPIENTS = 50;

function isValidPayload(body: Partial<MailEventPayload>): body is MailEventPayload {
  return Boolean(
    body.kind &&
    Array.isArray(body.to) &&
    body.to.length > 0 &&
    body.to.every((recipient) => recipient.email) &&
    body.params
  );
}

function isSameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<MailEventPayload>;
    if (!isValidPayload(body)) {
      return NextResponse.json({ error: "Invalid mail payload" }, { status: 400 });
    }
    if (body.to.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: "Too many recipients" }, { status: 400 });
    }
    if (body.actionUrl && !isSameOrigin(body.actionUrl, request.nextUrl.origin)) {
      return NextResponse.json({ error: "Mail links must point to this site" }, { status: 400 });
    }

    const supabase = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    if (SELF_ONLY_KINDS.has(body.kind)) {
      const ownEmail = user.email?.toLowerCase();
      if (!ownEmail || body.to.some((recipient) => recipient.email.toLowerCase() !== ownEmail)) {
        return NextResponse.json({ error: "This email can only be sent to your own address" }, { status: 403 });
      }
    } else if (OFFICIAL_KINDS.has(body.kind)) {
      const { data: memberships } = await (supabase.from("organization_members" as never) as unknown as {
        select: (columns: string) => { eq: (column: string, value: string) => Promise<{ data: { role: string }[] | null }> };
      }).select("role").eq("member_id", user.id);
      if (!(memberships ?? []).some((membership) => OFFICIAL_ROLES.includes(membership.role))) {
        return NextResponse.json({ error: "Only organization officials can send this email" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "This email cannot be sent from the browser" }, { status: 403 });
    }

    const result = await deliverMail(body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Mail route error:", error);
    return NextResponse.json({ error: "Internal mail error" }, { status: 500 });
  }
}
