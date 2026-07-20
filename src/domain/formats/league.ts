import { type Stage, type Round } from "../event";
import { type Match, type MatchParticipant } from "../match";
import { type Participant } from "../participant";
import { type RuleOverride, MatchStatus, FormatType } from "../types";
import { type FormatStrategy, type StageResult, type StandingsEntry } from "./interface";
import { getBoolRule, getNumberRule } from "../rules";
import { generateId } from "../../lib/id";
import { generateRoundRobin } from "@kurovu146/bracket-engine";

export class LeagueFormat implements FormatStrategy {
  readonly type = "league";

  createStages(eventId: string, participants: Participant[], rules: RuleOverride[]): StageResult[] {
    const doubleRR = getBoolRule(rules, "double_round_robin", FormatType.League);

    const participantIds = participants.map(p => p.id);
    const seeds = generateRoundRobin(participantIds, { doubleRoundRobin: doubleRR });

    const results: StageResult[] = [];

    const stage: Stage = {
      id: generateId(),
      eventId,
      name: "League Stage",
      type: "round_robin",
      orderIndex: 0,
      config: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const totalRounds = seeds.length > 0 ? Math.max(...seeds.map(s => s.round)) : 0;
    const rounds: Round[] = [];
    const matches: Match[] = [];

    for (let r = 1; r <= totalRounds; r++) {
      rounds.push({
        id: generateId(),
        stageId: stage.id,
        name: `Match Week ${r}`,
        roundNumber: r,
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    for (const seed of seeds) {
      const roundIdx = seed.round - 1;
      const match: Match = {
        id: generateId(),
        roundId: rounds[roundIdx]?.id ?? "",
        eventId,
        status: MatchStatus.Scheduled,
        participantIds: [seed.player1_id, seed.player2_id].filter((p): p is string => p !== null),
        participants: [],
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (seed.player1_id) {
        match.participants.push({ matchId: match.id, participantId: seed.player1_id, position: 1 });
      }
      if (seed.player2_id) {
        match.participants.push({ matchId: match.id, participantId: seed.player2_id, position: 2 });
      }

      matches.push(match);
    }

    results.push({ stage, rounds, matches });
    return results;
  }

  generateMatches(stage: Stage, round: Round, participants: MatchParticipant[], rules: RuleOverride[]): Match[] {
    return [];
  }

  propagateResults(allMatches: Match[], _rounds: Round[]): Match[] {
    return allMatches.map(m => ({ ...m, participants: [...m.participants], participantIds: [...m.participantIds] }));
  }

  calculateStandings(_stage: Stage, matches: Match[], participants: Participant[], rules: RuleOverride[]): StandingsEntry[] {
    const winPts = getNumberRule(rules, "win_points", FormatType.League) ?? 3;
    const drawPts = getNumberRule(rules, "draw_points", FormatType.League) ?? 1;
    const topN = getNumberRule(rules, "qualification_count", FormatType.League);

    const stats = new Map<string, { pts: number; w: number; l: number; d: number; gf: number; ga: number }>();

    for (const p of participants) {
      stats.set(p.id, { pts: 0, w: 0, l: 0, d: 0, gf: 0, ga: 0 });
    }

    for (const match of matches) {
      if (match.status !== MatchStatus.Completed || !match.result) continue;
      const [p1, p2] = match.participantIds;
      const s1 = match.result.scores.find(s => s.participantId === p1)?.value ?? 0;
      const s2 = match.result.scores.find(s => s.participantId === p2)?.value ?? 0;
      const r1 = stats.get(p1);
      const r2 = stats.get(p2);
      if (!r1 || !r2) continue;

      r1.gf += s1; r1.ga += s2;
      r2.gf += s2; r2.ga += s1;

      if (match.result.winnerId === p1) { r1.pts += winPts; r1.w++; r2.l++; }
      else if (match.result.winnerId === p2) { r2.pts += winPts; r2.w++; r1.l++; }
      else { r1.pts += drawPts; r2.pts += drawPts; r1.d++; r2.d++; }
    }

    const entries: StandingsEntry[] = participants.map(p => {
      const s = stats.get(p.id)!;
      return {
        participantId: p.id,
        displayName: p.displayName,
        rank: 0,
        points: s.pts,
        wins: s.w,
        losses: s.l,
        draws: s.d,
        stats: { goalsFor: s.gf, goalsAgainst: s.ga, goalDifference: s.gf - s.ga },
        qualified: false,
      };
    });

    entries.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = (a.stats.goalDifference ?? 0);
      const gdB = (b.stats.goalDifference ?? 0);
      if (gdB !== gdA) return gdB - gdA;
      return (b.stats.goalsFor ?? 0) - (a.stats.goalsFor ?? 0);
    });

    entries.forEach((e, i) => {
      e.rank = i + 1;
      e.qualified = topN ? i < topN : false;
    });

    return entries;
  }

  advanceParticipants(stage: Stage, standings: StandingsEntry[], rules: RuleOverride[]): string[] {
    const topN = getNumberRule(rules, "qualification_count", FormatType.League);
    return standings.slice(0, topN || standings.length).map(s => s.participantId);
  }
}
