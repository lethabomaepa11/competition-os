import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import type { Round, Stage } from "@/domain/event";
import type { Match, MatchScore } from "@/domain/match";
import { deliverMail } from "@/lib/mail/send";
import {
  buildParticipantNotices,
  type NoticeContact,
  type ParticipantNotice,
  type ParticipantNotification,
} from "@/lib/mail/participant-notices";

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
type ContactRow = { participant_id: string; display_name: string; status: string; email: string | null };

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function mapKeys(obj: unknown, convert: (k: string) => string): unknown {
  if (Array.isArray(obj)) return obj.map((v) => mapKeys(v, convert));
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[convert(k)] = mapKeys(v, convert);
    }
    return result;
  }
  return obj;
}

function expandResult(match: Record<string, unknown>): void {
  const winnerId = match.winnerId as string | undefined;
  const scores = match.scores as MatchScore[] | undefined;
  if (winnerId !== undefined || scores !== undefined) {
    match.result = {
      winnerId: winnerId ?? undefined,
      scores: scores ?? [],
      isWalkover: (match.isWalkover as boolean | undefined) ?? false,
      finalizedAt: match.finalizedAt as string | undefined,
    };
  }
}

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

    const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
    const { data: contactRows, error: contactError } = await rpc("event_participant_contacts", { p_event_id: id });
    if (contactError) return NextResponse.json({ error: contactError.message }, { status: 403 });
    const contacts = new Map<string, NoticeContact>((contactRows as ContactRow[]).map((row) => [
      row.participant_id,
      { displayName: row.display_name, status: row.status, email: row.email },
    ]));

    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("*, stages (*, rounds (*, matches (*, match_participants (*))))")
      .eq("id", id)
      .single();
    if (eventError || !eventData) {
      return NextResponse.json({ error: eventError?.message ?? "Event not found" }, { status: 404 });
    }

    const event = mapKeys(eventData, snakeToCamel) as Record<string, unknown>;
    const stages: Stage[] = [];
    const rounds: Round[] = [];
    const matches: Match[] = [];
    for (const stage of (event.stages as Record<string, unknown>[]) ?? []) {
      for (const round of (stage.rounds as Record<string, unknown>[]) ?? []) {
        for (const match of (round.matches as Record<string, unknown>[]) ?? []) {
          const entries = (match.matchParticipants as Record<string, unknown>[]) ?? [];
          expandResult(match);
          match.participants = entries;
          match.participantIds = [...entries]
            .sort((a, b) => (a.position as number) - (b.position as number))
            .map((entry) => entry.participantId);
          matches.push(match as unknown as Match);
        }
        rounds.push(round as unknown as Round);
      }
      stages.push(stage as unknown as Stage);
    }

    const { data: competition } = await supabase
      .from("competitions")
      .select("id, organizations (slug)")
      .eq("id", event.competitionId as string)
      .single();
    const orgSlug = (competition as { organizations?: { slug?: string } } | null)?.organizations?.slug ?? "";

    const notices = buildParticipantNotices({
      eventName: event.name as string,
      liveUrl: `${request.nextUrl.origin}/live/${orgSlug}/${event.competitionId as string}`,
      timeZone: typeof body.timeZone === "string" ? body.timeZone : undefined,
      stages,
      rounds,
      matches,
      contacts,
    }, notification);

    const deliver = async (notice: ParticipantNotice): Promise<"sent" | "skipped" | string> => {
      const contact = contacts.get(notice.participantId);
      if (!contact?.email) return "skipped";
      const { data: claimed, error } = await rpc("claim_participant_notification", { p_event_id: id, p_key: notice.key });
      if (error || claimed !== true) return "skipped";
      const sent = await deliverMail({ ...notice.mail, to: [{ email: contact.email, name: contact.displayName.trim() }] });
      if (sent.ok) return "sent";
      await rpc("release_participant_notification", { p_event_id: id, p_key: notice.key });
      return sent.error;
    };

    const outcomes = await Promise.all(notices.map(deliver));
    const failures = outcomes.filter((outcome) => outcome !== "sent" && outcome !== "skipped");
    return NextResponse.json({
      data: {
        sent: outcomes.filter((outcome) => outcome === "sent").length,
        skipped: outcomes.filter((outcome) => outcome === "skipped").length,
        failed: failures.length,
        errors: [...new Set(failures)],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
