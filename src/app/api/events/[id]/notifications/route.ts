import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import type { ParticipantNotification } from "@/lib/mail/participant-notices";
import { deliverParticipantNotifications, ParticipantNotificationForbidden } from "@/lib/mail/participant-delivery";

function parseNotification(body: Record<string, unknown>): ParticipantNotification | null {
  if (body.type === "bracket_generated" && typeof body.stageId === "string") {
    return { type: "bracket_generated", stageId: body.stageId };
  }
  if (["match_scheduled", "match_started", "match_result"].includes(body.type as string) && typeof body.matchId === "string") {
    return { type: body.type as "match_scheduled" | "match_started" | "match_result", matchId: body.matchId };
  }
  return null;
}

/** Emails the entrants affected by an operator action. Only event officials may call it. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const notification = parseNotification(body);
    if (!notification) {
      return NextResponse.json({ error: "Invalid notification" }, { status: 400 });
    }

    const supabase = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const summary = await deliverParticipantNotifications(
      supabase,
      id,
      request.nextUrl.origin,
      [notification],
      typeof body.timeZone === "string" ? body.timeZone : undefined,
    );
    return NextResponse.json({ data: summary });
  } catch (err) {
    if (err instanceof ParticipantNotificationForbidden) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
