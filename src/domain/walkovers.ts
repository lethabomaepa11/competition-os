import type { Match, MatchResult } from "./match";
import { MatchStatus } from "./types";

type SettleableMatch = Pick<Match, "id" | "status" | "participantIds"> & { result?: MatchResult };

/**
 * Awards a walkover in every scheduled fixture where exactly one entrant has withdrawn,
 * then re-propagates and repeats, because a walkover can move the withdrawn entrant into
 * another fixture (a double-elimination loser drops into the losers' bracket).
 * Fixtures where both entrants withdrew are left for the operator to decide.
 */
export function settleWithdrawals<T extends SettleableMatch>(
  matches: T[],
  withdrawn: Set<string>,
  propagate: (matches: T[]) => T[],
  finalizedAt = new Date().toISOString(),
): { matches: T[]; walkovers: Map<string, string> } {
  let current = matches;
  const walkovers = new Map<string, string>();
  for (let pass = 0; withdrawn.size > 0 && pass < matches.length; pass++) {
    const forfeits = new Set(current
      .filter((m) => m.status === MatchStatus.Scheduled
        && m.participantIds.length === 2
        && m.participantIds.filter((id) => withdrawn.has(id)).length === 1)
      .map((m) => m.id));
    if (forfeits.size === 0) break;
    current = propagate(current.map((m) => {
      if (!forfeits.has(m.id)) return m;
      const winnerId = m.participantIds.find((id) => !withdrawn.has(id))!;
      walkovers.set(m.id, winnerId);
      return { ...m, status: MatchStatus.Walkover, result: { winnerId, scores: [], isWalkover: true, finalizedAt } };
    }));
  }
  return { matches: current, walkovers };
}
