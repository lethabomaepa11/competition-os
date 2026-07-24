import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import type { MatchScore } from "@/domain/match";

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
  const isWalkover = match.isWalkover as boolean | undefined;
  const notes = match.notes as string | undefined;
  const finalizedBy = match.finalizedBy as string | undefined;
  const finalizedAt = match.finalizedAt as string | undefined;
  if (winnerId !== undefined || scores !== undefined) {
    match.result = { winnerId, scores: scores ?? [], isWalkover: isWalkover ?? false, notes, finalizedBy, finalizedAt };
  }
  delete match.winnerId;
  delete match.isWalkover;
  delete match.notes;
  delete match.finalizedBy;
  delete match.finalizedAt;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const status = searchParams.get("status");
    const stageId = searchParams.get("stageId");
    const roundId = searchParams.get("roundId");
    const participantId = searchParams.get("participantId");
    const offset = (page - 1) * limit;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    });

    // First get all round IDs for this event (to filter matches by event)
    const { data: rawStages } = await supabase
      .from("stages")
      .select("id")
      .eq("event_id", id);
    const stageIds = ((rawStages ?? []) as Record<string, unknown>[]).map((s) => s.id as string);

    const { data: rawRounds } = await supabase
      .from("rounds")
      .select("id, stage_id")
      .in("stage_id", stageIds);

    const rounds = (rawRounds ?? []) as Record<string, unknown>[];
    const allRoundIds = rounds.map((r) => r.id as string);
    if (allRoundIds.length === 0) {
      return NextResponse.json({ data: { matches: [], total: 0, page, limit } });
    }

    let query = supabase
      .from("matches")
      .select("*, match_participants(*)", { count: "exact" })
      .in("round_id", allRoundIds);

    if (status) {
      query = query.eq("status", status);
    }
    if (roundId) {
      query = query.eq("round_id", roundId);
    }

    const { data: rawMatches, count } = await query
      .order("round_id", { ascending: true })
      .range(offset, offset + limit - 1);
    const allMatchesRaw = (rawMatches ?? []) as Record<string, unknown>[];

    if (allMatchesRaw.length === 0 && page === 1) {
      return NextResponse.json({ data: { matches: [], total: 0, page, limit } });
    }

    // Filter by stageId client-side since we already have all matches (supabase doesn't do nested joins)
    let filtered: Record<string, unknown>[] = allMatchesRaw;
    if (stageId) {
      const stageRoundIds = new Set(
        rounds.filter((r) => (r.stage_id as string) === stageId).map((r) => r.id as string),
      );
      filtered = filtered.filter((m) => (stageRoundIds as Set<string>).has(m.round_id as string));
    }

    // Convert and populate participants
    const matches = mapKeys(filtered, snakeToCamel) as Record<string, unknown>[];
    const allMatchParticipants: Record<string, unknown>[] = [];

    for (const match of matches) {
      const mps = (match.matchParticipants as Record<string, unknown>[]) ?? [];
      allMatchParticipants.push(
        ...mps.map((mp) => ({ ...mp, matchId: match.id })),
      );
      delete match.matchParticipants;
    }

    const mpByMatchId = new Map<string, Record<string, unknown>[]>();
    for (const mp of allMatchParticipants) {
      const mid = mp.matchId as string;
      const list = mpByMatchId.get(mid);
      if (list) list.push(mp); else mpByMatchId.set(mid, [mp]);
    }
    for (const match of matches) {
      const mps = mpByMatchId.get(match.id as string) ?? [];
      match.participantIds = mps.map((mp) => mp.participantId);
      match.participants = mps;
      expandResult(match);
    }

    // Filter by participantId client-side
    let finalMatches = matches;
    if (participantId) {
      finalMatches = matches.filter((m) =>
        (m.participantIds as string[]).includes(participantId),
      );
    }

    return NextResponse.json({
      data: {
        matches: finalMatches,
        total: count ?? 0,
        page,
        limit,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
