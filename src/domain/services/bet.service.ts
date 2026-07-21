import { type ID } from "../types";
import { type Bet, type BetterProfile, STARTING_BET_POINTS, MIN_BET, MAX_BET } from "../bet";
import { type Match } from "../match";
import { generateId } from "../../lib/id";
import { GetAll, GetWhere, create, update as storeUpdate } from "../../lib/store";

const BET_KEY = "bets";
const PROFILE_KEY = "better_profiles";

export class BetService {
  private async getProfiles(): Promise<BetterProfile[]> {
    return GetAll<BetterProfile>(PROFILE_KEY);
  }

  private async saveProfile(profile: BetterProfile): Promise<void> {
    const existing = await this.getProfiles();
    const idx = existing.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      await storeUpdate<BetterProfile>(PROFILE_KEY, profile.id, profile as Partial<BetterProfile>);
    } else {
      await create(PROFILE_KEY, profile);
    }
  }

  async getOrCreateProfile(betterId: ID, name: string): Promise<BetterProfile> {
    const profiles = await this.getProfiles();
    let profile = profiles.find(p => p.id === betterId);
    if (!profile) {
      profile = {
        id: betterId,
        name,
        totalPoints: STARTING_BET_POINTS,
        betsWon: 0,
        betsLost: 0,
        totalWagered: 0,
        netPoints: 0,
      };
      await this.saveProfile(profile);
    }
    return profile;
  }

  async getProfile(betterId: ID): Promise<BetterProfile | undefined> {
    const profiles = await GetWhere<BetterProfile>(PROFILE_KEY, { id: betterId });
    return profiles[0];
  }

  async placeBet(betterId: ID, betterName: string, matchId: ID, eventId: ID, participantId: ID, points: number): Promise<Bet | string> {
    const profile = await this.getOrCreateProfile(betterId, betterName);

    if (points < MIN_BET) return `Minimum bet is ${MIN_BET} points`;
    if (points > MAX_BET) return `Maximum bet is ${MAX_BET} points`;
    if (points > profile.totalPoints) return `Not enough points (you have ${profile.totalPoints})`;

    const existingBets = (await this.getMatchBets(matchId)).filter(b => b.betterId === betterId);
    if (existingBets.length > 0) return "You already placed a bet on this match";

    const bet: Bet = {
      id: generateId(),
      matchId,
      eventId,
      participantId,
      betterId,
      betterName,
      pointsWagered: points,
      placedAt: new Date().toISOString(),
      settled: false,
      won: false,
      pointsAwarded: 0,
    };
    await create(BET_KEY, bet);

    await this.deductPoints(betterId, points);
    return bet;
  }

  async settleBets(match: Match): Promise<void> {
    if (!match.result) return;
    const bets = await this.getMatchBets(match.id);
    for (const bet of bets) {
      if (bet.settled) continue;
      const won = match.result.winnerId === bet.participantId;
      const payout = won ? bet.pointsWagered * 2 : 0;
      await storeUpdate<Bet>(BET_KEY, bet.id, { settled: true, won, pointsAwarded: payout } as Partial<Bet>);
      const profile = await this.getProfile(bet.betterId);
      if (profile) {
        profile.totalPoints += payout;
        if (won) profile.betsWon++;
        else profile.betsLost++;
        profile.totalWagered += bet.pointsWagered;
        profile.netPoints = profile.totalPoints - STARTING_BET_POINTS;
        await this.saveProfile(profile);
      }
    }
  }

  async undoBetSettlement(matchId: ID): Promise<void> {
    const bets = await this.getMatchBets(matchId);
    for (const bet of bets) {
      if (!bet.settled) continue;
      await storeUpdate<Bet>(BET_KEY, bet.id, { settled: false, won: false, pointsAwarded: 0 } as Partial<Bet>);
      const profile = await this.getProfile(bet.betterId);
      if (profile) {
        profile.totalPoints -= bet.pointsAwarded;
        if (bet.won) profile.betsWon--;
        else profile.betsLost--;
        profile.totalWagered -= bet.pointsWagered;
        profile.netPoints = profile.totalPoints - STARTING_BET_POINTS;
        await this.saveProfile(profile);
      }
    }
  }

  private async deductPoints(betterId: ID, points: number): Promise<void> {
    const profile = await this.getProfile(betterId);
    if (profile) {
      profile.totalPoints -= points;
      await this.saveProfile(profile);
    }
  }

  async getMatchBets(matchId: ID): Promise<Bet[]> {
    return GetWhere<Bet>(BET_KEY, { matchId });
  }

  async getEventBets(eventId: ID): Promise<Bet[]> {
    return GetWhere<Bet>(BET_KEY, { eventId });
  }

  async getLeaderboard(limit: number = 10): Promise<BetterProfile[]> {
    const profiles = await this.getProfiles();
    return profiles
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit);
  }
}
