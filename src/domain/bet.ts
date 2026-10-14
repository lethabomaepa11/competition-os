import { type ID } from "./types";

export interface Bet {
  id: ID;
  matchId: ID;
  eventId: ID;
  participantId: ID;
  betterId: ID | null;
  betterName: string;
  pointsWagered: number;
  placedAt: string;
  settled: boolean;
  won: boolean;
  pointsAwarded: number;
  decimalOdds?: number;
  guestTokenHash?: string | null;
}

export interface BetterProfile {
  id: ID;
  name: string;
  totalPoints: number;
  betsWon: number;
  betsLost: number;
  totalWagered: number;
  netPoints: number;
}

export const STARTING_BET_POINTS = 100;
export const MIN_BET = 5;
export const MAX_BET = 50;
