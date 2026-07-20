import { type Stage, type Round } from "../event";
import { type Match, type MatchParticipant } from "../match";
import { type Participant } from "../participant";
import { type RuleOverride, MatchStatus, FormatType } from "../types";
import { type FormatStrategy, type StageResult, type StandingsEntry } from "./interface";
import { getNumberRule } from "../rules";
import { generateId } from "../../lib/id";
import { generateSwiss } from "@kurovu146/bracket-engine";

export class SwissFormat implements FormatStrategy {
  readonly type = "swiss";

  createStages(eventId: string, participants: Participant[], rules: RuleOverride[]): StageResult[] {
    const numRounds = getNumberRule(rules, "rounds", FormatType.Swiss);
    const participantIds = participants.map(p => p.id);

    const seeds = generateSwiss(participantIds, { numRounds });

    const totalRounds = seeds.length > 0 ? Math.max(...seeds.map(s => s.round)) : 0;

    const stage: Stage = {
      id: generateId(),
      eventId,
      name: "Swiss Stage",
      type: "swiss",
      orderIndex: 0,
      config: { numRounds: totalRounds },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const rounds: Round[] = [];
    for (let r = 1; r <= totalRounds; r++) {
      rounds.push({
        id: generateId(),
        stageId: stage.id,
        name: `Round ${r}`,
        roundNumber: r,
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const round1Seeds = seeds.filter(s => s.round === 1);
    const matches: Match[] = [];

    for (const seed of round1Seeds) {
      const match: Match = {
        id: generateId(),
        roundId: rounds[0]?.id ?? "",
        eventId,
        status: seed.is_bye ? MatchStatus.Walkover : MatchStatus.Scheduled,
        participantIds: [seed.player1_id, seed.player2_id].filter((p): p is string => p !== null),
        participants: [],
        config: { roundNumber: 1, swissMatchIndex: seed.match_number },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (seed.player1_id) {
        match.participants.push({ matchId: match.id, participantId: seed.player1_id, position: 1 });
      }
      if (seed.player2_id) {
        match.participants.push({ matchId: match.id, participantId: seed.player2_id, position: 2 });
      }

      if (seed.is_bye) {
        const winnerId = seed.player1_id ?? seed.player2_id;
        match.result = { winnerId: winnerId ?? undefined, scores: [], isWalkover: true };
      }

      matches.push(match);
    }

    return [{ stage, rounds, matches }];
  }

  generateMatches(_stage: Stage, _round: Round, _participants: MatchParticipant[], _rules: RuleOverride[]): Match[] {
    return [];
  }

  pairRound(
    eventId: string,
    stage: Stage,
    roundId: string,
    roundNumber: number,
    allMatches: Match[],
    activeParticipants: Participant[],
    rules: RuleOverride[],
  ): Match[] {
    const standings = this.calculateStandings(stage, allMatches, activeParticipants, rules);

    const pairedIds = new Set<string>();
    for (const m of allMatches) {
      if (m.roundId === roundId) {
        for (const pid of m.participantIds) pairedIds.add(pid);
      }
    }

    const eligible = standings.filter(s => !pairedIds.has(s.participantId));

    const sorted = [...eligible].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return (b.stats.buchholz ?? 0) - (a.stats.buchholz ?? 0);
    });

    const newMatches: Match[] = [];
    const used = new Set<string>();

    for (let i = 0; i < sorted.length; i++) {
      if (used.has(sorted[i].participantId)) continue;

      if (i + 1 >= sorted.length) {
        const p = sorted[i];
        const match = this.createByeMatch(eventId, stage.id, roundId, roundNumber, p.participantId);
        newMatches.push(match);
        used.add(p.participantId);
        continue;
      }

      let p1 = sorted[i];
      let p2 = sorted[i + 1];

      if (this.havePlayed(p1.participantId, p2.participantId, allMatches)) {
        let swapped = false;
        for (let j = i + 2; j < sorted.length; j++) {
          if (used.has(sorted[j].participantId)) continue;
          if (!this.havePlayed(p1.participantId, sorted[j].participantId, allMatches)) {
            p2 = sorted[j];
            swapped = true;
            break;
          }
        }
        if (!swapped) {
          for (let j = i + 2; j < sorted.length; j++) {
            if (used.has(sorted[j].participantId)) continue;
            if (!this.havePlayed(p1.participantId, sorted[j].participantId, allMatches)) {
              p2 = sorted[j];
              swapped = true;
              break;
            }
          }
        }
        if (!swapped) {
          p2 = sorted[i + 1];
        }
      }

      const match: Match = {
        id: generateId(),
        roundId,
        eventId,
        status: MatchStatus.Scheduled,
        participantIds: [p1.participantId, p2.participantId],
        participants: [
          { matchId: "", participantId: p1.participantId, position: 1 },
          { matchId: "", participantId: p2.participantId, position: 2 },
        ],
        config: { roundNumber, swissRound: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      match.participants[0].matchId = match.id;
      match.participants[1].matchId = match.id;

      newMatches.push(match);
      used.add(p1.participantId);
      used.add(p2.participantId);
    }

    return newMatches;
  }

  private havePlayed(pid1: string, pid2: string, allMatches: Match[]): boolean {
    return allMatches.some(m => {
      if (m.status !== MatchStatus.Completed && m.status !== MatchStatus.Scheduled) return false;
      return m.participantIds.includes(pid1) && m.participantIds.includes(pid2);
    });
  }

  private createByeMatch(eventId: string, stageId: string, roundId: string, roundNumber: number, participantId: string): Match {
    return {
      id: generateId(),
      roundId,
      eventId,
      status: MatchStatus.Walkover,
      participantIds: [participantId],
      participants: [{ matchId: "", participantId, position: 1 }],
      result: { winnerId: participantId, scores: [], isWalkover: true },
      config: { roundNumber, swissRound: true, isBye: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  propagateResults(allMatches: Match[], _rounds: Round[]): Match[] {
    return allMatches.map(m => ({
      ...m,
      participants: [...m.participants],
      participantIds: [...m.participantIds],
    }));
  }

  calculateStandings(_stage: Stage, matches: Match[], participants: Participant[], rules: RuleOverride[]): StandingsEntry[] {
    const winPts = getNumberRule(rules, "win_points", FormatType.Swiss) ?? 1;
    const drawPts = getNumberRule(rules, "draw_points", FormatType.Swiss) ?? 0.5;
    const topN = getNumberRule(rules, "qualification_count", FormatType.Swiss);

    const stats = new Map<string, { pts: number; w: number; l: number; d: number; opponents: string[] }>();

    for (const p of participants) {
      stats.set(p.id, { pts: 0, w: 0, l: 0, d: 0, opponents: [] });
    }

    for (const match of matches) {
      if (match.status !== MatchStatus.Completed || !match.result) continue;
      if (match.participantIds.length < 2 && !match.result.isWalkover) continue;

      if (match.result.isWalkover && match.participantIds.length === 1) {
        const pid = match.participantIds[0];
        const s = stats.get(pid);
        if (s) {
          s.pts += winPts;
          s.w++;
        }
        continue;
      }

      const [p1, p2] = match.participantIds;
      const s1 = stats.get(p1);
      const s2 = stats.get(p2);
      if (!s1 || !s2) continue;

      s1.opponents.push(p2);
      s2.opponents.push(p1);

      if (match.result.winnerId === p1) { s1.pts += winPts; s1.w++; s2.l++; }
      else if (match.result.winnerId === p2) { s2.pts += winPts; s2.w++; s1.l++; }
      else { s1.pts += drawPts; s2.pts += drawPts; s1.d++; s2.d++; }
    }

    const buchholz = new Map<string, number>();
    for (const p of participants) {
      const s = stats.get(p.id);
      if (!s) { buchholz.set(p.id, 0); continue; }
      let sum = 0;
      for (const oppId of s.opponents) {
        const opp = stats.get(oppId);
        if (opp) sum += opp.pts;
      }
      buchholz.set(p.id, sum);
    }

    const entries: StandingsEntry[] = participants.map(p => {
      const s = stats.get(p.id);
      return {
        participantId: p.id,
        displayName: p.displayName,
        rank: 0,
        points: s?.pts ?? 0,
        wins: s?.w ?? 0,
        losses: s?.l ?? 0,
        draws: s?.d ?? 0,
        stats: { buchholz: buchholz.get(p.id) ?? 0, roundsPlayed: s?.opponents.length ?? 0 },
        qualified: false,
      };
    });

    entries.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return (b.stats.buchholz ?? 0) - (a.stats.buchholz ?? 0);
    });

    entries.forEach((e, i) => {
      e.rank = i + 1;
      e.qualified = topN ? i < topN : false;
    });

    return entries;
  }

  advanceParticipants(_stage: Stage, standings: StandingsEntry[], rules: RuleOverride[]): string[] {
    const topN = getNumberRule(rules, "qualification_count", FormatType.Swiss);
    return standings.slice(0, topN || standings.length).map(s => s.participantId);
  }
}
