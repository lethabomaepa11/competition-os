import { type Stage, type Round } from "../event";
import { type Match, type MatchParticipant } from "../match";
import { type Participant } from "../participant";
import { type RuleOverride, MatchStatus, FormatType } from "../types";
import { type FormatStrategy, type StageResult, type StandingsEntry } from "./interface";
import { getNumberRule, getBoolRule } from "../rules";
import { generateId } from "../../lib/id";
import { generateGroupStage } from "@kurovu146/bracket-engine";

const GROUP_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];

export class GroupStageFormat implements FormatStrategy {
  readonly type = "group_stage";

  createStages(eventId: string, participants: Participant[], rules: RuleOverride[]): StageResult[] {
    const doubleRR = getBoolRule(rules, "double_round_robin", FormatType.GroupStage);
    const numGroups = getNumberRule(rules, "group_count", FormatType.GroupStage) || 4;
    const qualifiersPerGroup = getNumberRule(rules, "qualifiers_per_group", FormatType.GroupStage) || 2;
    const winPts = getNumberRule(rules, "win_points", FormatType.GroupStage) || 3;
    const drawPts = getNumberRule(rules, "draw_points", FormatType.GroupStage) || 1;

    const participantIds = participants.map(p => p.id);
    const result = generateGroupStage(participantIds, { numGroups, distribution: "snake", doubleRoundRobin: doubleRR });

    const stage: Stage = {
      id: generateId(),
      eventId,
      name: "Group Stage",
      type: "group_stage",
      orderIndex: 0,
      config: {
        groups: result.groups,
        qualifiersPerGroup,
        winPts,
        drawPts,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const groupMatchMap = new Map<number, typeof result.matches>();
    for (const seed of result.matches) {
      const gIdx = this.parseGroupIndex(seed.bracket_type);
      if (gIdx === -1) continue;
      if (!groupMatchMap.has(gIdx)) groupMatchMap.set(gIdx, []);
      groupMatchMap.get(gIdx)!.push(seed);
    }

    const rounds: Round[] = [];
    const matches: Match[] = [];
    let roundOrder = 0;

    const sortedGroupIndices = Array.from(groupMatchMap.keys()).sort();

    for (const gIdx of sortedGroupIndices) {
      let seeds = groupMatchMap.get(gIdx)!;
      const groupName = GROUP_LABELS[gIdx] || `Group ${gIdx + 1}`;

      // When double round-robin, offset second pass round numbers
      // so each pair's two fixtures are in distinct rounds
      if (doubleRR) {
        const n = result.groups[gIdx].length;
        const singleRRMatchCount = n * (n - 1) / 2;
        if (seeds.length > singleRRMatchCount) {
          const roundsPerPass = n > 1 ? (n % 2 === 0 ? n - 1 : n) : 1;
          seeds = [
            ...seeds.slice(0, singleRRMatchCount),
            ...seeds.slice(singleRRMatchCount).map(s => ({ ...s, round: s.round + roundsPerPass })),
          ];
        }
      }

      const groupRoundNumbers = [...new Set(seeds.map(s => s.round))].sort();

      for (const gr of groupRoundNumbers) {
        roundOrder++;
        const round: Round = {
          id: generateId(),
          stageId: stage.id,
          name: `${groupName} - Round ${gr}`,
          roundNumber: roundOrder,
          config: { groupIndex: gIdx, groupName, groupRound: gr },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        rounds.push(round);

        const roundSeeds = seeds.filter(s => s.round === gr);
        for (const seed of roundSeeds) {
          const match: Match = {
            id: generateId(),
            roundId: round.id,
            eventId,
            status: seed.is_bye ? MatchStatus.Walkover : MatchStatus.Scheduled,
            participantIds: [seed.player1_id, seed.player2_id].filter((p): p is string => p !== null),
            participants: [],
            config: {
              groupIndex: gIdx,
              groupName,
              groupRound: gr,
            },
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
      }
    }

    return [{ stage, rounds, matches }];
  }

  generateMatches(_stage: Stage, _round: Round, _participants: MatchParticipant[], _rules: RuleOverride[]): Match[] {
    return [];
  }

  propagateResults(allMatches: Match[], _rounds: Round[]): Match[] {
    return allMatches.map(m => ({
      ...m,
      participants: [...m.participants],
      participantIds: [...m.participantIds],
    }));
  }

  calculateStandings(stage: Stage, matches: Match[], participants: Participant[], rules: RuleOverride[]): StandingsEntry[] {
    const winPts = getNumberRule(rules, "win_points", FormatType.GroupStage) || 3;
    const drawPts = getNumberRule(rules, "draw_points", FormatType.GroupStage) || 1;
    const qualifiersPerGroup = stage.config?.qualifiersPerGroup as number ?? 2;
    const groups = this.readGroups(stage);

    const isDoubleRR = getBoolRule(rules, "double_round_robin", FormatType.GroupStage);
    const participantsByGroup = this.buildGroupParticipantMap(groups, participants);
    const matchesByGroup = this.buildGroupMatchMap(matches);

    const allEntries: StandingsEntry[] = [];
    const groupLabels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];

    for (const [gIdx, groupPids] of participantsByGroup.entries()) {
      const groupLabel = groupLabels[gIdx] || `Group ${gIdx + 1}`;
      const groupMatches = matchesByGroup.get(gIdx) ?? [];

      const stats = new Map<string, {
        pts: number; w: number; l: number; d: number; gf: number; ga: number;
        hw: number; hd: number; hl: number; hgf: number; hga: number;
        aw: number; ad: number; al: number; agf: number; aga: number;
      }>();

      for (const pid of groupPids) {
        stats.set(pid, {
          pts: 0, w: 0, l: 0, d: 0, gf: 0, ga: 0,
          hw: 0, hd: 0, hl: 0, hgf: 0, hga: 0,
          aw: 0, ad: 0, al: 0, agf: 0, aga: 0,
        });
      }

      for (const match of groupMatches) {
        if (match.status !== MatchStatus.Completed || !match.result) continue;
        if (match.participantIds.length < 2) {
          if (match.result.isWalkover && match.participantIds.length === 1) {
            const pid = match.participantIds[0];
            const s = stats.get(pid);
            if (s) { s.pts += winPts; s.w++; }
          }
          continue;
        }

        const [p1, p2] = match.participantIds;
        const s1 = stats.get(p1);
        const s2 = stats.get(p2);
        if (!s1 || !s2) continue;

        const sc1 = match.result.scores.find(s => s.participantId === p1)?.value ?? 0;
        const sc2 = match.result.scores.find(s => s.participantId === p2)?.value ?? 0;
        s1.gf += sc1; s1.ga += sc2;
        s2.gf += sc2; s2.ga += sc1;

        if (match.result.winnerId === p1) { s1.pts += winPts; s1.w++; s2.l++; }
        else if (match.result.winnerId === p2) { s2.pts += winPts; s2.w++; s1.l++; }
        else { s1.pts += drawPts; s2.pts += drawPts; s1.d++; s2.d++; }

        if (isDoubleRR) {
          const p1IsHome = match.participants.find(p => p.participantId === p1)?.position === 1;
          if (match.result.winnerId === p1) {
            if (p1IsHome) { s1.hw++; s2.al++; } else { s1.aw++; s2.hl++; }
          } else if (match.result.winnerId === p2) {
            if (p1IsHome) { s2.aw++; s1.hl++; } else { s2.hw++; s1.al++; }
          } else {
            if (p1IsHome) { s1.hd++; s2.ad++; } else { s1.ad++; s2.hd++; }
          }
          if (p1IsHome) {
            s1.hgf += sc1; s1.hga += sc2; s2.agf += sc2; s2.aga += sc1;
          } else {
            s1.agf += sc1; s1.aga += sc2; s2.hgf += sc2; s2.hga += sc1;
          }
        }
      }

      const entries: StandingsEntry[] = groupPids.map(pid => {
        const participant = participants.find(p => p.id === pid);
        const s = stats.get(pid)!;
        return {
          participantId: pid,
          displayName: participant?.displayName ?? "Unknown",
          rank: 0,
          points: s.pts,
          wins: s.w,
          losses: s.l,
          draws: s.d,
          stats: {
            goalsFor: s.gf, goalsAgainst: s.ga, goalDifference: s.gf - s.ga, groupIndex: gIdx,
            ...(isDoubleRR ? {
              homeWins: s.hw, homeDraws: s.hd, homeLosses: s.hl,
              homeGoalsFor: s.hgf, homeGoalsAgainst: s.hga,
              awayWins: s.aw, awayDraws: s.ad, awayLosses: s.al,
              awayGoalsFor: s.agf, awayGoalsAgainst: s.aga,
            } : {}),
          },
          qualified: false,
          groupName: groupLabel,
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
        e.qualified = qualifiersPerGroup > 0 && i < qualifiersPerGroup;
      });

      allEntries.push(...entries);
    }

    return allEntries;
  }

  advanceParticipants(stage: Stage, standings: StandingsEntry[], _rules: RuleOverride[]): string[] {
    const qualifiersPerGroup = stage.config?.qualifiersPerGroup as number ?? 2;
    const groups = this.readGroups(stage);

    const byGroup = new Map<number, StandingsEntry[]>();
    for (const entry of standings) {
      const gIdx = entry.stats?.groupIndex ?? 0;
      if (!byGroup.has(gIdx)) byGroup.set(gIdx, []);
      byGroup.get(gIdx)!.push(entry);
    }

    const qualifiers: string[] = [];
    const sortedGroupIndices = groups.map((_, i) => i);

    for (let rank = 0; rank < qualifiersPerGroup; rank++) {
      for (const gIdx of sortedGroupIndices) {
        const groupEntries = byGroup.get(gIdx) ?? [];
        const alreadyTaken = new Set(qualifiers);
        const available = groupEntries.filter(e => !alreadyTaken.has(e.participantId));
        if (rank < available.length) {
          qualifiers.push(available[rank].participantId);
        }
      }
    }

    return qualifiers;
  }

  private parseGroupIndex(bracketType: string): number {
    const match = bracketType.match(/^group_(\d+)$/);
    return match ? parseInt(match[1], 10) : -1;
  }

  private readGroups(stage: Stage): string[][] {
    const raw = stage.config?.groups;
    if (Array.isArray(raw)) return raw as string[][];
    return [];
  }

  private buildGroupParticipantMap(groups: string[][], participants: Participant[]): Map<number, string[]> {
    const map = new Map<number, string[]>();
    const participantMap = new Map(participants.map(p => [p.id, p]));
    for (let i = 0; i < groups.length; i++) {
      const pids = groups[i].filter(pid => participantMap.has(pid));
      map.set(i, pids);
    }
    return map;
  }

  private buildGroupMatchMap(matches: Match[]): Map<number, Match[]> {
    const map = new Map<number, Match[]>();
    for (const match of matches) {
      const gIdx = match.config?.groupIndex as number | undefined;
      if (gIdx === undefined) continue;
      if (!map.has(gIdx)) map.set(gIdx, []);
      map.get(gIdx)!.push(match);
    }
    return map;
  }
}
