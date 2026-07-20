import { type ID, type Timestamps, MatchStatus, BracketGroup } from "./types";

export interface MatchParticipant {
  matchId: ID;
  participantId: ID;
  position: number;
  result?: "win" | "loss" | "draw";
  score?: number;
}

export interface MatchScore {
  participantId: ID;
  label: string;
  value: number;
}

export interface MatchResult {
  winnerId?: ID;
  scores: MatchScore[];
  isWalkover: boolean;
  notes?: string;
  finalizedBy?: ID;
  finalizedAt?: string;
}

export interface Match extends Timestamps {
  id: ID;
  roundId: ID;
  eventId: ID;
  bracketGroup?: BracketGroup;
  status: MatchStatus;
  participantIds: ID[];
  participants: MatchParticipant[];
  result?: MatchResult;
  scheduledAt?: string;
  startedAt?: string;
  venue?: string;
  config: Record<string, unknown>;
}
