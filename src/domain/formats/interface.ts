import { type Stage, type Round } from "../event";
import { type Match, type MatchParticipant } from "../match";
import { type Participant } from "../participant";
import { type RuleOverride } from "../types";

export interface StageResult {
  stage: Stage;
  rounds: Round[];
  matches: Match[];
}

export interface StandingsEntry {
  participantId: string;
  displayName: string;
  rank: number;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  stats: Record<string, number>;
  qualified: boolean;
  groupName?: string;
}

export interface FormatStrategy {
  readonly type: string;

  createStages(
    eventId: string,
    participants: Participant[],
    rules: RuleOverride[],
  ): StageResult[];

  generateMatches(
    stage: Stage,
    round: Round,
    participants: MatchParticipant[],
    rules: RuleOverride[],
  ): Match[];

  calculateStandings(
    stage: Stage,
    matches: Match[],
    participants: Participant[],
    rules: RuleOverride[],
  ): StandingsEntry[];

  advanceParticipants(
    stage: Stage,
    standings: StandingsEntry[],
    rules: RuleOverride[],
  ): string[];

  propagateResults(
    allMatches: Match[],
    rounds: Round[],
  ): Match[];
}
