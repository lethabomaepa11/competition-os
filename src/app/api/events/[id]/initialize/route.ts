import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { getFormat } from "@/domain/formats/registry";
import type { Participant } from "@/domain/participant";
import type { Stage, Round } from "@/domain/event";
import type { Match } from "@/domain/match";

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const participantIds: string[] = body.participantIds;

    if (!participantIds || participantIds.length < 2) {
      return NextResponse.json({ error: "At least 2 participants required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    });

    const { data: rawEvent } = await (supabase.from("events" as never) as any)
      .select("*")
      .eq("id", id)
      .single();

    if (!rawEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = mapKeys(rawEvent, snakeToCamel) as Record<string, unknown>;

    const { data: rawRuleSets } = await (supabase.from("rule_sets" as never) as any)
      .select("*")
      .eq("event_id", id);
    const ruleSets = ((rawRuleSets ?? []) as Record<string, unknown>[]).map((r) => mapKeys(r, snakeToCamel));
    const rules = (ruleSets.length > 0 ? (ruleSets[0] as Record<string, unknown>).rules : []) as any[];

    const { data: rawParticipants } = await (supabase.from("participants" as never) as any)
      .select("*")
      .in("id", participantIds);
    const participants = ((rawParticipants ?? []) as Record<string, unknown>[]).map((p) => mapKeys(p, snakeToCamel)) as unknown as Participant[];

    if (participants.length < 2) {
      return NextResponse.json({ error: "Not enough valid participants" }, { status: 400 });
    }

    const format = getFormat(event.format as string);
    const stageResults = format.createStages(id, participants, rules);

    const allStages: Record<string, unknown>[] = [];
    const allRounds: Record<string, unknown>[] = [];
    const allMatches: Record<string, unknown>[] = [];

    for (const result of stageResults) {
      const stagePayload = mapKeys(result.stage as unknown as Record<string, unknown>, camelToSnake) as Record<string, unknown>;
      delete stagePayload.id;

      const { data: createdStage } = await (supabase.from("stages" as never) as any)
        .insert(stagePayload)
        .select()
        .single();
      if (!createdStage) throw new Error("Failed to create stage");
      const serverStage = mapKeys(createdStage, snakeToCamel) as Record<string, unknown>;
      allStages.push(serverStage);

      const oldToNewRoundId = new Map<string, string>();

      for (const round of result.rounds) {
        const oldRoundId = round.id;
        const roundPayload = mapKeys(round as unknown as Record<string, unknown>, camelToSnake) as Record<string, unknown>;
        roundPayload.stage_id = serverStage.id;
        delete roundPayload.id;

        const { data: createdRound } = await (supabase.from("rounds" as never) as any)
          .insert(roundPayload)
          .select()
          .single();
        if (!createdRound) throw new Error("Failed to create round");
        const serverRound = mapKeys(createdRound, snakeToCamel) as Record<string, unknown>;
        oldToNewRoundId.set(oldRoundId, serverRound.id as string);
        allRounds.push(serverRound);
      }

      for (const match of result.matches) {
        match.eventId = id;
        const newRoundId = oldToNewRoundId.get(match.roundId);
        if (newRoundId) match.roundId = newRoundId;

        const { participantIds: mpIds, participants: mps, result: matchResult, ...cleanMatch } = match as unknown as Record<string, unknown>;
        let matchPayload = mapKeys(cleanMatch, camelToSnake) as Record<string, unknown>;
        delete matchPayload.id;

        if (matchResult) {
          const r = matchResult as Record<string, unknown>;
          matchPayload.winner_id = r.winnerId ?? null;
          matchPayload.scores = r.scores ?? [];
          matchPayload.is_walkover = r.isWalkover ?? false;
          matchPayload.notes = r.notes ?? null;
          matchPayload.finalized_by = r.finalizedBy ?? null;
          matchPayload.finalized_at = r.finalizedAt ?? null;
        }
        delete matchPayload.result;

        const { data: createdMatch } = await (supabase.from("matches" as never) as any)
          .insert(matchPayload)
          .select()
          .single();
        if (!createdMatch) throw new Error("Failed to create match");
        const serverMatch = mapKeys(createdMatch, snakeToCamel) as Record<string, unknown>;

        // Create match_participants
        const participantList = (mps as any[]).length > 0 ? mps as any[] : (mpIds as string[]).map((pid: string, i: number) => ({ participantId: pid, position: i + 1 }));
        for (const mp of participantList) {
          await (supabase.from("match_participants" as never) as any).insert({
            match_id: serverMatch.id,
            participant_id: mp.participantId,
            position: mp.position,
            result: null,
            score: null,
          } as any);
        }

        serverMatch.participantIds = mpIds;
        serverMatch.participants = participantList.map((mp: any) => ({ ...mp, matchId: serverMatch.id }));
        allMatches.push(serverMatch);
      }
    }

    // Start the event
    await (supabase.from("events" as never) as any).update({ status: "in_progress" }).eq("id", id);

    // Send mail notifications
    const { data: rawProfiles } = await (supabase.from("profiles" as never) as any)
      .select("id, email, display_name")
      .in("id", participants.map((p: any) => p.memberId));
    const profileMap = new Map(((rawProfiles ?? []) as any[]).map((p: any) => [p.id, p]));
    const recipients = participants
      .map((p: any) => {
        const profile = profileMap.get(p.memberId);
        return profile ? { email: profile.email, name: profile.display_name } : null;
      })
      .filter(Boolean);

    if (recipients.length > 0) {
      const host = request.headers.get("host") ?? "localhost:3000";
      const protocol = host.includes("localhost") ? "http" : "https";
      const baseUrl = `${protocol}://${host}`;
      const orgSlug = body.orgSlug ?? "";
      const compId = body.competitionId ?? "";
      const actionUrl = `${baseUrl}/o/${orgSlug}/competitions/${compId}/events/${id}`;
      const eventName = (event as any).name ?? "Event";

      const mailPayloads = [
        { kind: "event_started", to: recipients, actionUrl, params: { eventName, actionLabel: "View event" } },
        { kind: "bracket_generated", to: recipients, actionUrl, params: { eventName, actionLabel: "View fixtures" } },
      ];

      for (const payload of mailPayloads) {
        fetch(`${baseUrl}/api/mail`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      data: {
        stages: allStages,
        rounds: allRounds,
        matches: allMatches,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
