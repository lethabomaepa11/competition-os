import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { getFormat } from "@/domain/formats/registry";
import { MatchStatus } from "@/domain/types";
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
  if (winnerId !== undefined || scores !== undefined) {
    match.result = { winnerId, scores: scores ?? [], isWalkover: isWalkover ?? false, notes, finalizedBy, finalizedAt };
  }
  delete match.winnerId;
  delete match.isWalkover;
  delete match.notes;
  delete match.finalizedBy;
  delete match.finalizedAt;
}

export async function POST(
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

    if (eventErr || !eventData) {
      return NextResponse.json({ error: eventErr?.message ?? "Event not found" }, { status: 500 });
    }

    const converted = mapKeys(eventData, snakeToCamel) as Record<string, unknown>;
    const stages = (converted.stages as Record<string, unknown>[]) ?? [];
    const allRounds: Record<string, unknown>[] = [];
    const rawMatches: Record<string, unknown>[] = [];
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
          expandResult(match);
          rawMatches.push(match);
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
    for (const match of rawMatches) {
      const mps = mpByMatchId.get(match.id as string) ?? [];
      match.participantIds = mps.map((mp) => mp.participantId);
      match.participants = mps;
    }

    // Clone for propagation
    const allMatches = rawMatches.map((m) => ({
      ...m,
      participants: [...(m.participants as Record<string, unknown>[])],
      participantIds: [...(m.participantIds as string[])],
    })) as Record<string, unknown>[];

    const stageTypeToFormat: Record<string, FormatType> = {
      round_robin: "league" as FormatType,
      single_elimination: "single_elimination" as FormatType,
      double_elimination: "double_elimination" as FormatType,
      swiss: "swiss" as FormatType,
      group_stage: "group_stage" as FormatType,
    };

    let propagated: any[] = allMatches as any[];
    const seenTypes = new Set<string>();
    for (const stage of stages) {
      if (seenTypes.has(stage.type as string)) continue;
      seenTypes.add(stage.type as string);
      const ft = stageTypeToFormat[stage.type as string];
      if (!ft) continue;
      const stageRoundIds = new Set(
        allRounds.filter((r) => r.stageId === stage.id).map((r) => r.id),
      );
      let stageOnlyMatches = propagated.filter((m) =>
        stageRoundIds.has(m.roundId),
      );
      stageOnlyMatches = stageOnlyMatches.sort((a, b) => {
        const aIdx = (a.config as Record<string, unknown> | undefined)?.["engineMatchIndex"] as number ?? 0;
        const bIdx = (b.config as Record<string, unknown> | undefined)?.["engineMatchIndex"] as number ?? 0;
        return aIdx - bIdx;
      });
      const propagatedStage = getFormat(ft).propagateResults(
        stageOnlyMatches as any,
        allRounds as any,
      );
      const propMap = new Map(propagatedStage.map((m) => [(m as any).id as string, m]));
      propagated = propagated.map((m) => propMap.get(m.id) ?? m);
    }

    // Find changed matches and save to DB
    const originalMap = new Map(rawMatches.map((m) => [m.id as string, m]));
    const changedIds = new Set<string>();
    for (const m of propagated) {
      const orig = originalMap.get(m.id);
      if (!orig) continue;
      const participantsChanged =
        JSON.stringify(m.participants) !== JSON.stringify(orig.participants) ||
        JSON.stringify(m.participantIds) !== JSON.stringify(orig.participantIds);
      if (participantsChanged) {
        changedIds.add(m.id);
      }
    }

    for (const m of propagated) {
      if (!changedIds.has(m.id)) continue;
      const { participantIds, participants, result, ...cleanMatch } = m;
      const dbPayload: Record<string, unknown> = { ...cleanMatch };
      if (result) {
        const r = result;
        dbPayload.winnerId = r.winnerId ?? null;
        dbPayload.scores = r.scores;
        dbPayload.isWalkover = r.isWalkover ?? false;
        dbPayload.notes = r.notes ?? null;
        dbPayload.finalizedBy = r.finalizedBy ?? null;
        dbPayload.finalizedAt = r.finalizedAt ?? null;
      }
      delete dbPayload.result;

      await (supabase.from("matches" as never) as any).update(dbPayload).eq("id", m.id);
      await (supabase.from("match_participants" as never) as any).delete().eq("match_id", m.id);
      for (let i = 0; i < participantIds.length; i++) {
        await (supabase.from("match_participants" as never) as any).insert({
          match_id: m.id,
          participant_id: participantIds[i],
          position: i + 1,
          result: null,
          score: null,
        });
      }
    }

    // Check auto-advance eligibility
    let canAdvance = false;
    if (converted?.config) {
      const cfg = converted.config as Record<string, unknown>;
      const plan = cfg?.progressionPlan as Record<string, unknown> | undefined;
      if (plan) {
        const phases = plan.phases as Record<string, unknown>[] | undefined;
        if (phases) {
          const sortedStages = [...stages].sort(
            (a, b) => (a.orderIndex as number) - (b.orderIndex as number),
          );
          for (const stage of sortedStages) {
            const stageIdx = sortedStages.indexOf(stage);
            if (stageIdx >= phases.length) continue;
            if (!phases[stageIdx]) continue;

            const stageRoundIds = new Set(
              allRounds.filter((r) => r.stageId === stage.id).map((r) => r.id),
            );
            const stageMatches = rawMatches.filter((m) =>
              stageRoundIds.has(m.roundId),
            );
            if (stageMatches.length === 0) continue;
            const allDone = stageMatches.every(
              (m) =>
                m.status === MatchStatus.Completed ||
                m.status === MatchStatus.Walkover ||
                m.status === MatchStatus.Cancelled,
            );
            if (!allDone) continue;

            const { data: existingLinks } = await supabase
              .from("progression_links")
              .select("id")
              .eq("event_id", id)
              .eq("source_stage_id", stage.id as string)
              .limit(1);
            if (existingLinks && existingLinks.length > 0) continue;

            canAdvance = true;
            break;
          }
        }
      }
    }

    return NextResponse.json({
      data: {
        matchCount: rawMatches.length,
        changedCount: changedIds.size,
        canAdvance,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
