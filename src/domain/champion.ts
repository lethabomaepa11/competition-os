import type { Event, Round, Stage } from "./event";
import type { Match } from "./match";
import type { Participant } from "./participant";
import type { StandingsEntry } from "./formats/interface";
import { EventStatus, MatchStatus } from "./types";

export type ChampionResolution =
  | { state: "pending" }
  | { state: "tied" }
  | { state: "winner"; participant: Participant; finalMatch?: Match };

/** Resolves a champion only after the event is explicitly completed. */
export function resolveEventChampion(input: {
  event: Event;
  stages: Stage[];
  rounds: Round[];
  matches: Match[];
  participants: Participant[];
  standings: StandingsEntry[];
}): ChampionResolution {
  const { event, stages, rounds, matches, participants, standings } = input;
  if (event.status !== EventStatus.Completed) return { state: "pending" };

  const finalStage = [...stages].sort((a, b) => b.orderIndex - a.orderIndex)[0];
  if (finalStage && ["single_elimination", "double_elimination"].includes(finalStage.type)) {
    const stageRounds = rounds.filter((round) => round.stageId === finalStage.id);
    const resetRound = stageRounds.find((round) => /grand final reset/i.test(round.name));
    const resetMatch = resetRound && matches.find((match) => match.roundId === resetRound.id);
    if (resetMatch && resetMatch.status !== MatchStatus.Cancelled) {
      if (![MatchStatus.Completed, MatchStatus.Walkover].includes(resetMatch.status) || !resetMatch.result?.winnerId) return { state: "pending" };
      const resetWinner = participants.find((entry) => entry.id === resetMatch.result?.winnerId);
      return resetWinner ? { state: "winner", participant: resetWinner, finalMatch: resetMatch } : { state: "pending" };
    }
    const targetRound = stageRounds.filter((round) => /final/i.test(round.name) && !/reset/i.test(round.name))
      .sort((a, b) => b.roundNumber - a.roundNumber)[0] ?? [...stageRounds].sort((a, b) => b.roundNumber - a.roundNumber)[0];
    if (!targetRound) return { state: "pending" };
    const finalMatches = matches.filter((match) => match.roundId === targetRound.id && match.bracketGroup !== "losers" && match.status !== MatchStatus.Cancelled);
    if (finalMatches.length !== 1) return { state: finalMatches.length > 1 ? "tied" : "pending" };
    const finalMatch = finalMatches[0];
    if (![MatchStatus.Completed, MatchStatus.Walkover].includes(finalMatch.status) || !finalMatch.result?.winnerId) return { state: "pending" };
    const participant = participants.find((entry) => entry.id === finalMatch.result?.winnerId);
    return participant ? { state: "winner", participant, finalMatch } : { state: "pending" };
  }

  const leaders = standings.filter((entry) => entry.rank === 1);
  if (leaders.length !== 1) return { state: leaders.length > 1 ? "tied" : "pending" };
  const participant = participants.find((entry) => entry.id === leaders[0].participantId);
  return participant ? { state: "winner", participant } : { state: "pending" };
}
