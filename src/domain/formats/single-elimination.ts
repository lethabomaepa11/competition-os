import { type Stage, type Round } from "../event";
import { type Match, type MatchParticipant } from "../match";
import { type Participant } from "../participant";
import { type RuleOverride, MatchStatus, FormatType } from "../types";
import { type FormatStrategy, type StageResult, type StandingsEntry } from "./interface";
import { getBoolRule, getNumberRule } from "../rules";
import { generateId } from "../../lib/id";
import { generateSingleElimination } from "@kurovu146/bracket-engine";

export class SingleEliminationFormat implements FormatStrategy {
  readonly type = "single_elimination";

  createStages(eventId: string, participants: Participant[], rules: RuleOverride[]): StageResult[] {
    const useSeeding = getBoolRule(rules, "seeding", FormatType.SingleElimination);
    const thirdPlace = getBoolRule(rules, "third_place_match", FormatType.SingleElimination);

    let seeded = [...participants];
    if (useSeeding) {
      seeded.sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
    }

    const participantIds = seeded.map(p => p.id);
    const seeds = generateSingleElimination(participantIds, { thirdPlaceMatch: thirdPlace });

    const totalRounds = Math.max(...seeds.map(s => s.round));
    const results: StageResult[] = [];

    const stage: Stage = {
      id: generateId(),
      eventId,
      name: "Main Bracket",
      type: "single_elimination",
      orderIndex: 0,
      config: { bracketSize: Math.pow(2, Math.ceil(Math.log2(participantIds.length))), thirdPlace },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const rounds: Round[] = [];
    const matches: Match[] = [];

    for (let r = 1; r <= totalRounds; r++) {
      const isFinal = r === totalRounds;
      const isSemi = !thirdPlace && r === totalRounds - 1;
      const round: Round = {
        id: generateId(),
        stageId: stage.id,
        name: isFinal ? "Final" : isSemi ? "Semi-Finals" : `Round ${r}`,
        roundNumber: r,
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      rounds.push(round);
    }

    const roundSeeds = seeds.filter(s => !s.bracket_type.startsWith("third_place"));
    const thirdPlaceSeeds = seeds.filter(s => s.bracket_type.startsWith("third_place"));

    for (const seed of roundSeeds) {
      const roundIdx = seed.round - 1;
      const seedParticipantIds = [seed.player1_id, seed.player2_id].filter((p): p is string => p !== null);
      const match: Match = {
        id: generateId(),
        roundId: rounds[roundIdx]?.id ?? "",
        eventId,
        status: seed.is_bye ? MatchStatus.Walkover : MatchStatus.Scheduled,
        participantIds: [...seedParticipantIds],
        participants: [],
        config: {
          seedParticipantIds,
          engineMatchIndex: seed.match_number - 1,
          nextMatchIndex: seed.next_match_index,
          nextMatchSlot: seed.next_match_slot,
          roundName: seed.round_name,
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

    if (thirdPlace && thirdPlaceSeeds.length > 0) {
      const thirdRound: Round = {
        id: generateId(),
        stageId: stage.id,
        name: "Third Place",
        roundNumber: totalRounds + 1,
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      rounds.push(thirdRound);

      for (const seed of thirdPlaceSeeds) {
        const seedParticipantIds = [seed.player1_id, seed.player2_id].filter((p): p is string => p !== null);
        const match: Match = {
          id: generateId(),
          roundId: thirdRound.id,
          eventId,
          status: seed.is_bye ? MatchStatus.Walkover : MatchStatus.Scheduled,
          participantIds: [...seedParticipantIds],
          participants: [],
          config: { thirdPlace: true, seedParticipantIds, engineMatchIndex: seed.match_number - 1 },
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
    }

    results.push({ stage, rounds, matches });
    return results;
  }

  generateMatches(stage: Stage, round: Round, participants: MatchParticipant[], rules: RuleOverride[]): Match[] {
    return [];
  }

  calculateStandings(stage: Stage, matches: Match[], participants: Participant[], rules: RuleOverride[]): StandingsEntry[] {
    const thirdPlace = getBoolRule(rules, "third_place_match", FormatType.SingleElimination);
    const finalMatch = matches.find(m => {
      const rn = m.config?.roundName;
      return rn === "Final" && !m.config?.thirdPlace;
    });
    const thirdMatch = matches.find(m => m.config?.thirdPlace);

    const finalists = finalMatch?.participants.map(p => p.participantId) ?? [];
    const winner = finalMatch?.result?.winnerId;
    const loser = finalists.find(id => id !== winner);

    const semiFinalMatches = matches.filter(m => {
      const rn = m.config?.roundName;
      return rn === "Semi-final" || rn === "Semi-Finals";
    });

    const thirdWinnerId = thirdMatch?.result?.winnerId;

    const lossMap = new Map<string, number>();
    for (const match of matches) {
      if (match.status === MatchStatus.Completed && match.result?.winnerId) {
        match.participantIds.forEach(pid => {
          if (pid !== match.result!.winnerId) {
            lossMap.set(pid, (lossMap.get(pid) ?? 0) + 1);
          }
        });
      }
    }

    const entries: StandingsEntry[] = participants.map(p => {
      const isWinner = p.id === winner;
      const isFinalist = finalists.includes(p.id) && p.id !== winner;
      const isSemiFinalist = semiFinalMatches.some(m => m.participantIds.includes(p.id)) && !finalists.includes(p.id);

      let rank = participants.length;
      if (isWinner) rank = 1;
      else if (thirdPlace && p.id === thirdWinnerId) rank = 2;
      else if (isFinalist) rank = thirdPlace ? 3 : 2;
      else if (isSemiFinalist) rank = thirdPlace ? 4 : 3;

      const wins = matches.filter(m => m.status === MatchStatus.Completed && m.result?.winnerId === p.id).length;
      const losses = matches.filter(m => m.status === MatchStatus.Completed && m.participantIds.includes(p.id) && m.result?.winnerId !== p.id).length;

      return {
        participantId: p.id,
        displayName: p.displayName,
        rank,
        points: wins,
        wins,
        losses,
        draws: 0,
        stats: { roundsPlayed: wins + losses },
        qualified: rank <= (getNumberRule(rules, "qualification_count", FormatType.SingleElimination) || 999),
      };
    });

    entries.sort((a, b) => a.rank - b.rank);
    return entries;
  }

  propagateResults(allMatches: Match[], _rounds: Round[]): Match[] {
    const updated = allMatches.map(m => {
      const seedIds = m.config?.seedParticipantIds as string[] | undefined;
      if (seedIds) {
        const seedParticipants: MatchParticipant[] = seedIds.map((pid, i) => ({
          matchId: m.id,
          participantId: pid,
          position: i + 1,
        }));
        return { ...m, participantIds: [...seedIds], participants: seedParticipants };
      }
      return { ...m, participants: [...m.participants], participantIds: [...m.participantIds] };
    });

    for (const match of updated) {
      if (match.status !== MatchStatus.Completed || !match.result?.winnerId) continue;

      const nextIdx = match.config?.nextMatchIndex as number | undefined;
      const nextSlot = match.config?.nextMatchSlot as string | undefined;
      if (nextIdx === undefined || nextIdx < 0 || nextIdx >= updated.length) continue;

      const target = updated[nextIdx];
      if (!target) continue;

      if (!target.participantIds.includes(match.result.winnerId)) {
        target.participantIds.push(match.result.winnerId);
        target.participants.push({
          matchId: target.id,
          participantId: match.result.winnerId,
          position: nextSlot === "player2" ? 2 : target.participants.length + 1,
        });
      }

      if (match.config?.roundName === "Semi-final" || match.config?.roundName === "Semi-Finals") {
        const loserId = match.participantIds.find(pid => pid !== match.result!.winnerId);
        if (loserId) {
          const thirdPlaceMatch = updated.find(m => m.config?.thirdPlace);
          if (thirdPlaceMatch && !thirdPlaceMatch.participantIds.includes(loserId)) {
            thirdPlaceMatch.participantIds.push(loserId);
            thirdPlaceMatch.participants.push({
              matchId: thirdPlaceMatch.id,
              participantId: loserId,
              position: thirdPlaceMatch.participants.length + 1,
            });
          }
        }
      }
    }

    return updated;
  }

  advanceParticipants(stage: Stage, standings: StandingsEntry[], rules: RuleOverride[]): string[] {
    const finalMatch = stage.config?.advanceAll ? standings.map(s => s.participantId) : [standings[0]?.participantId].filter(Boolean);
    return finalMatch;
  }
}
