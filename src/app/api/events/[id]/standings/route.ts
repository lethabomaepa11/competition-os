import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { getFormat } from "@/domain/formats/registry";
import type { FormatType } from "@/domain/types";
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
  if (winnerId !== undefined || scores !== undefined || isWalkover !== undefined || notes !== undefined || finalizedBy !== undefined || finalizedAt !== undefined) {
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
    const stageId = searchParams.get("stageId");

    if (!stageId) {
      return NextResponse.json({ error: "stageId query parameter is required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    });

    const { data: rawEvent, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();
    const event = rawEvent as Record<string, unknown> | null;

    if (eventErr || !event) {
      return NextResponse.json({ error: eventErr?.message ?? "Event not found" }, { status: 404 });
    }

    const { data: rawStages } = await supabase
      .from("stages")
      .select("*")
      .eq("event_id", id)
      .order("order_index");
    const stages = (rawStages ?? []) as Record<string, unknown>[];

    const stage = stages.find((s) => s.id === stageId);
    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    const { data: rawRounds } = await supabase
      .from("rounds")
      .select("*")
      .eq("stage_id", stageId);
    const rounds = (rawRounds ?? []) as Record<string, unknown>[];

    const stageRoundIds = new Set(rounds.map((r) => r.id as string));

    const { data: rawAllMatches } = await supabase
      .from("matches")
      .select("*")
      .eq("event_id", id);
    const allMatches = (rawAllMatches ?? []) as Record<string, unknown>[];

    const matches = allMatches.filter((m) => stageRoundIds.has(m.round_id as string));
    const matchIds = matches.map((m) => m.id as string);

    const { data: rawMatchParticipants } = matchIds.length > 0
      ? await supabase.from("match_participants").select("*").in("match_id", matchIds)
      : { data: [] };
    const matchParticipants = (rawMatchParticipants ?? []) as Record<string, unknown>[];

    const mpByMatchId = new Map<string, Record<string, unknown>[]>();
    for (const mp of matchParticipants) {
      const mid = mp.match_id as string;
      const list = mpByMatchId.get(mid);
      if (list) list.push(mp); else mpByMatchId.set(mid, [mp]);
    }

    for (const match of matches) {
      const mps = mpByMatchId.get(match.id as string) ?? [];
      match.participant_ids = mps.map((mp) => mp.participant_id);
      match.participants = mps;
    }

    const { data: rawParticipants } = await supabase
      .from("participants")
      .select("*")
      .eq("event_id", id);
    const participants = (rawParticipants ?? []) as Record<string, unknown>[];

    const { data: rawRuleSets } = await supabase
      .from("rule_sets")
      .select("*")
      .eq("event_id", id);
    const ruleSets = (rawRuleSets ?? []) as Record<string, unknown>[];

    const rules = (ruleSets[0]?.rules ?? []) as Record<string, unknown>[];

    const camelStage = mapKeys(stage, snakeToCamel) as Record<string, unknown>;
    const camelMatches = matches.map((m) => {
      const cm = mapKeys(m, snakeToCamel) as Record<string, unknown>;
      expandResult(cm);
      return cm;
    });
    const camelParticipants = participants.map((p) => mapKeys(p, snakeToCamel));

    const format = getFormat(event.format as FormatType);
    const standings = format.calculateStandings(
      camelStage as never,
      camelMatches as never,
      camelParticipants as never,
      rules as never,
    );

    return NextResponse.json({ data: standings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
