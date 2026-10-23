import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Round, Stage } from "@/domain/event";
import type { Match, MatchScore } from "@/domain/match";
import { deliverMail } from "./send";
import {
  buildParticipantNotices,
  type NoticeContact,
  type ParticipantNotice,
  type ParticipantNotification,
} from "./participant-notices";

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
type ContactRow = { participant_id: string; display_name: string; status: string; email: string | null };

/** Raised when the caller may not email this event's entrants. */
export class ParticipantNotificationForbidden extends Error {}

export interface DeliverySummary {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

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

/**
 * Emails the entrants affected by operator actions, as the signed-in official.
 * Each email is claimed in the notification log first, so it is sent at most once.
 */
export async function deliverParticipantNotifications(
  supabase: SupabaseClient<Database>,
  eventId: string,
  origin: string,
  notifications: ParticipantNotification[],
  timeZone?: string,
): Promise<DeliverySummary> {
  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
  const { data: contactRows, error: contactError } = await rpc("event_participant_contacts", { p_event_id: eventId });
  if (contactError) throw new ParticipantNotificationForbidden(contactError.message);
  const contacts = new Map<string, NoticeContact>((contactRows as ContactRow[]).map((row) => [
    row.participant_id,
    { displayName: row.display_name, status: row.status, email: row.email },
  ]));

  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("*, stages (*, rounds (*, matches (*, match_participants (*))))")
    .eq("id", eventId)
    .single();
  if (eventError || !eventData) throw new Error(eventError?.message ?? "Event not found");

  const event = mapKeys(eventData, snakeToCamel) as Record<string, unknown>;
  const stages: Stage[] = [];
  const rounds: Round[] = [];
  const matches: Match[] = [];
  for (const stage of (event.stages as Record<string, unknown>[]) ?? []) {
    for (const round of (stage.rounds as Record<string, unknown>[]) ?? []) {
      for (const match of (round.matches as Record<string, unknown>[]) ?? []) {
        const entries = [...((match.matchParticipants as Record<string, unknown>[]) ?? [])]
          .sort((a, b) => (a.position as number) - (b.position as number));
        expandResult(match);
        match.participants = entries;
        match.participantIds = entries.map((entry) => entry.participantId);
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

  const context = {
    eventName: event.name as string,
    liveUrl: `${origin}/live/${orgSlug}/${event.competitionId as string}`,
    timeZone,
    stages,
    rounds,
    matches,
    contacts,
  };
  const notices = notifications.flatMap((notification) => buildParticipantNotices(context, notification));

  const deliver = async (notice: ParticipantNotice): Promise<"sent" | "skipped" | string> => {
    const contact = contacts.get(notice.participantId);
    if (!contact?.email) return "skipped";
    const { data: claimed, error } = await rpc("claim_participant_notification", { p_event_id: eventId, p_key: notice.key });
    if (error || claimed !== true) return "skipped";
    const sent = await deliverMail({ ...notice.mail, to: [{ email: contact.email, name: contact.displayName.trim() }] });
    if (sent.ok) return "sent";
    await rpc("release_participant_notification", { p_event_id: eventId, p_key: notice.key });
    return sent.error;
  };

  const outcomes = await Promise.all(notices.map(deliver));
  const failures = outcomes.filter((outcome) => outcome !== "sent" && outcome !== "skipped");
  return {
    sent: outcomes.filter((outcome) => outcome === "sent").length,
    skipped: outcomes.filter((outcome) => outcome === "skipped").length,
    failed: failures.length,
    errors: [...new Set(failures)],
  };
}
