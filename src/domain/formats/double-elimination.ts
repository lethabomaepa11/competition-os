import { type Stage, type Round } from "../event";
import { type Match, type MatchParticipant } from "../match";
import { type Participant } from "../participant";
import { type RuleOverride, MatchStatus, BracketGroup, FormatType } from "../types";
import { type FormatStrategy, type StageResult, type StandingsEntry } from "./interface";
import { getBoolRule, getNumberRule } from "../rules";
import { generateId } from "../../lib/id";
import { generateDoubleElimination } from "@kurovu146/bracket-engine";
import type { MatchSeed } from "@kurovu146/bracket-engine";

const BRACKET_TYPE_ORDER = ["winners", "losers", "grand_final"];

export class DoubleEliminationFormat implements FormatStrategy {
  readonly type = "double_elimination";

  createStages(eventId: string, participants: Participant[], rules: RuleOverride[]): StageResult[] {
    const useSeeding = getBoolRule(rules, "seeding", FormatType.DoubleElimination);

    let seeded = [...participants];
    if (useSeeding) {
      seeded.sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
    }

    const participantIds = seeded.map(p => p.id);
    const seeds = generateDoubleElimination(participantIds, { grandFinalReset: false });

    const stage: Stage = {
      id: generateId(),
      eventId,
      name: "Double Elimination",
      type: "double_elimination",
      orderIndex: 0,
      config: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { rounds, roundForSeed } = this.buildRounds(stage.id, seeds);
    const matches = this.buildMatches(eventId, seeds, rounds, roundForSeed);

    return [{ stage, rounds, matches }];
  }

  private buildRounds(stageId: string, seeds: MatchSeed[]): { rounds: Round[]; roundForSeed: Map<MatchSeed, Round> } {
    const rounds: Round[] = [];
    const roundForSeed = new Map<MatchSeed, Round>();
    let roundNumber = 1;

    for (const bracketType of BRACKET_TYPE_ORDER) {
      const typeSeeds = seeds.filter(s => s.bracket_type === bracketType);
      const roundNums = [...new Set(typeSeeds.map(s => s.round))].sort((a, b) => a - b);

      for (const rn of roundNums) {
        const sampleSeed = typeSeeds.find(s => s.round === rn)!;
        const name = bracketType === "winners"
          ? (sampleSeed.round_name ?? `WB Round ${rn}`)
          : bracketType === "losers"
            ? (sampleSeed.round_name ?? `LB Round ${rn}`)
            : "Grand Final";

        const round: Round = {
          id: generateId(),
          stageId,
          name,
          roundNumber: roundNumber++,
          config: { bracketType },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        rounds.push(round);

        for (const seed of typeSeeds) {
          if (seed.round === rn) {
            roundForSeed.set(seed, round);
          }
        }
      }
    }

    return { rounds, roundForSeed };
  }

  private buildMatches(eventId: string, seeds: MatchSeed[], rounds: Round[], roundForSeed: Map<MatchSeed, Round>): Match[] {
    return seeds.map(seed => {
      const round = roundForSeed.get(seed)!;

      const bracketGroup = seed.bracket_type === "winners" ? BracketGroup.Winners
        : seed.bracket_type === "losers" ? BracketGroup.Losers
        : BracketGroup.Finals;

      const match: Match = {
        id: generateId(),
        roundId: round?.id ?? "",
        eventId,
        bracketGroup,
        status: seed.is_bye ? MatchStatus.Walkover : MatchStatus.Scheduled,
        participantIds: [seed.player1_id, seed.player2_id].filter((p): p is string => p !== null),
        participants: [],
        config: {
          engineMatchIndex: seed.match_number - 1,
          nextMatchIndex: seed.next_match_index,
          nextMatchSlot: seed.next_match_slot,
          loserNextMatchIndex: seed.loser_next_match_index,
          loserNextMatchSlot: seed.loser_next_match_slot,
          bracketGroup,
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

      return match;
    });
  }

  generateMatches(stage: Stage, round: Round, participants: MatchParticipant[], rules: RuleOverride[]): Match[] {
    return [];
  }

  propagateResults(allMatches: Match[], _rounds: Round[]): Match[] {
    const updated = allMatches.map(m => ({ ...m, participants: [...m.participants], participantIds: [...m.participantIds] }));

    for (const match of updated) {
      if ((match.status !== MatchStatus.Completed && match.status !== MatchStatus.Walkover) || !match.result?.winnerId) continue;

      const nextIdx = match.config?.nextMatchIndex as number | undefined;
      const nextSlot = match.config?.nextMatchSlot as string | undefined;
      if (nextIdx !== undefined && nextIdx >= 0 && nextIdx < updated.length) {
        const target = updated[nextIdx];
        if (target && !target.participantIds.includes(match.result.winnerId)) {
          target.participantIds.push(match.result.winnerId);
          target.participants.push({
            matchId: target.id,
            participantId: match.result.winnerId,
            position: nextSlot === "player2" ? 2 : target.participants.length + 1,
          });
        }
      }

      const loserNextIdx = match.config?.loserNextMatchIndex as number | undefined;
      const loserNextSlot = match.config?.loserNextMatchSlot as string | undefined;
      if (loserNextIdx !== undefined && loserNextIdx >= 0 && loserNextIdx < updated.length) {
        const loserId = match.participantIds.find(pid => pid !== match.result!.winnerId);
        if (loserId) {
          const target = updated[loserNextIdx];
          if (target && !target.participantIds.includes(loserId)) {
            target.participantIds.push(loserId);
            target.participants.push({
              matchId: target.id,
              participantId: loserId,
              position: loserNextSlot === "player2" ? 2 : target.participants.length + 1,
            });
          }
        }
      }
    }

    return updated;
  }

  calculateStandings(stage: Stage, matches: Match[], participants: Participant[], rules: RuleOverride[]): StandingsEntry[] {
    const lossMap = new Map<string, number>();
    const winMap = new Map<string, number>();
    const matchCountMap = new Map<string, number>();

    for (const match of matches) {
      if (match.status === MatchStatus.Completed && match.result?.winnerId) {
        match.participantIds.forEach(pid => {
          matchCountMap.set(pid, (matchCountMap.get(pid) ?? 0) + 1);
          if (pid !== match.result!.winnerId) {
            lossMap.set(pid, (lossMap.get(pid) ?? 0) + 1);
          } else {
            winMap.set(pid, (winMap.get(pid) ?? 0) + 1);
          }
        });
      }
    }

    const entries: StandingsEntry[] = participants.map(p => {
      const losses = lossMap.get(p.id) ?? 0;
      const wins = winMap.get(p.id) ?? 0;

      let rank = participants.length;
      if (losses === 0) rank = 1;
      else if (losses === 1) rank = 2;
      else rank = 2 + losses;

      return {
        participantId: p.id,
        displayName: p.displayName,
        rank,
        points: wins,
        wins,
        losses,
        draws: 0,
        stats: { roundsPlayed: matchCountMap.get(p.id) ?? 0 },
        qualified: rank <= (getNumberRule(rules, "qualification_count", FormatType.DoubleElimination) || 999),
      };
    });

    entries.sort((a, b) => a.rank - b.rank);
    return entries;
  }

  advanceParticipants(stage: Stage, standings: StandingsEntry[], rules: RuleOverride[]): string[] {
    return stage.config?.advanceAll ? standings.map(s => s.participantId) : [standings[0]?.participantId].filter(Boolean);
  }
}
