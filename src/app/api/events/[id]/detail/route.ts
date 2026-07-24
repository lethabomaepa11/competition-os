import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    });

    const { data: eventData, error: eventErr } = await supabase
      .from("events")
      .select(`
        *,
        stages (
          *,
          rounds (
            *,
            matches (
              *,
              match_participants (*)
            )
          )
        )
      `)
      .eq("id", id)
      .single();

    if (eventErr) {
      return NextResponse.json({ error: eventErr.message }, { status: 500 });
    }
    if (!eventData) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const [
      { data: participants },
      { data: teams },
      { data: ruleSets },
      { data: invites },
      { data: progressionLinks },
      { data: awardedPoints },
      { data: otherEvents },
    ] = await Promise.all([
      supabase.from("participants").select("*").eq("event_id", id),
      supabase.from("teams").select("*"),
      supabase.from("rule_sets").select("*").eq("event_id", id),
      supabase.from("participant_invites").select("*").eq("event_id", id),
      supabase.from("progression_links").select("*").eq("event_id", id),
      supabase.from("awarded_points").select("*").eq("event_id", id),
      supabase.from("events").select("*").eq("competition_id", eventData.competition_id),
    ]);

    const converted = mapKeys(eventData, snakeToCamel) as Record<string, unknown>;
    const stages = (converted.stages as Record<string, unknown>[]) ?? [];
    const allRounds: Record<string, unknown>[] = [];
    const allMatches: Record<string, unknown>[] = [];
    const allMatchParticipants: Record<string, unknown>[] = [];

    for (const stage of stages) {
      const rounds = (stage.rounds as Record<string, unknown>[]) ?? [];
      for (const round of rounds) {
        const matches = (round.matches as Record<string, unknown>[]) ?? [];
        for (const match of matches) {
          const mps = (match.matchParticipants as Record<string, unknown>[]) ?? [];
          allMatchParticipants.push(
            ...mps.map((mp) => ({ ...mp, matchId: match.id })),
          );
          delete match.matchParticipants;
          allMatches.push(match);
        }
        delete round.matches;
        allRounds.push(round);
      }
      delete stage.rounds;
    }

    const mpByMatchId = new Map<string, Record<string, unknown>[]>();
    for (const mp of allMatchParticipants) {
      const mid = mp.matchId as string;
      const list = mpByMatchId.get(mid);
      if (list) list.push(mp); else mpByMatchId.set(mid, [mp]);
    }
    for (const match of allMatches) {
      const mps = mpByMatchId.get(match.id as string) ?? [];
      match.participantIds = mps.map((mp) => mp.participantId);
      match.participants = mps;
    }

    const otherEventsMapped = (mapKeys(otherEvents ?? [], snakeToCamel) as Record<string, unknown>[]).filter(
      (ev) => ev.id !== id,
    );

    return NextResponse.json({
      data: {
        event: converted,
        stages,
        rounds: allRounds,
        matches: allMatches,
        participants: mapKeys(participants ?? [], snakeToCamel),
        teams: mapKeys(teams ?? [], snakeToCamel),
        ruleSets: mapKeys(ruleSets ?? [], snakeToCamel),
        invites: mapKeys(invites ?? [], snakeToCamel),
        progressionLinks: mapKeys(progressionLinks ?? [], snakeToCamel),
        awardedPoints: mapKeys(awardedPoints ?? [], snakeToCamel),
        otherEvents: otherEventsMapped,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
