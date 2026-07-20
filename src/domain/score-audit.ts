import { type ID } from "./types";

export interface ScoreAuditEntry {
  id: ID;
  matchId: ID;
  eventId: ID;
  participantId: ID;
  score: number;
  actionType: "set" | "increment" | "decrement" | "finalize";
  timestamp: string;
  matchElapsedMs?: number;
  roundNumber?: number;
  stageName?: string;
}

export interface MatchTiming {
  id: ID;
  matchId: ID;
  eventId: ID;
  startedAt: string;
  finalizedAt?: string;
  durationMs?: number;
}

export interface ParticipantScoreSummary {
  participantId: ID;
  displayName: string;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  totalScoreFor: number;
  totalScoreAgainst: number;
  avgScoreFor: number;
  avgScoreAgainst: number;
  highestScore: number;
  lowestScore: number;
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  last5Results: ("win" | "loss" | "draw")[];
  avgMatchDurationMs: number;
  comebackWins: number;
  dominantWins: number;
  closeWins: number;
}

export interface MatchScoreEvent {
  matchId: ID;
  eventId: ID;
  participantId: ID;
  participantName: string;
  score: number;
  timestamp: string;
  roundNumber?: number;
}

export interface InterestingFact {
  type: "streak" | "comeback" | "dominant" | "close_match" | "high_score" | "low_score" | "milestone" | "form" | "consistency" | "duration" | "perfect_record" | "probability";
  title: string;
  description: string;
  severity: "normal" | "interesting" | "amazing" | "record";
  participantIds?: ID[];
}

export interface MatchInsight {
  matchId: ID;
  p1WinProb: number;
  p2WinProb: number;
  drawProb: number;
  p1PredictedScore: number;
  p2PredictedScore: number;
  facts: InterestingFact[];
}
