import type { Match } from "./match";

export interface PredictionPrice {
  probability: number;
  decimalOdds: number;
  sampleSize: number;
  basis: "event-form";
}

interface FormRecord { wins: number; played: number }

/**
 * Produces illustrative, no-margin prices from completed event matches only.
 * A Beta(2,2) prior softens small samples; estimates are withheld until both
 * entrants have at least one decided result and the event has two samples.
 */
export function calculatePredictionOdds(
  matches: Match[],
  participantAId: string,
  participantBId: string,
): [PredictionPrice, PredictionPrice] | null {
  const form = new Map<string, FormRecord>();
  let sampleSize = 0;

  for (const match of matches) {
    const winnerId = match.status === "completed" ? match.result?.winnerId : undefined;
    if (!winnerId || match.participantIds.length !== 2 || !match.participantIds.includes(winnerId)) continue;
    sampleSize += 1;
    for (const participantId of match.participantIds) {
      const record = form.get(participantId) ?? { wins: 0, played: 0 };
      record.played += 1;
      if (participantId === winnerId) record.wins += 1;
      form.set(participantId, record);
    }
  }

  const a = form.get(participantAId);
  const b = form.get(participantBId);
  if (!a || !b || a.played === 0 || b.played === 0 || sampleSize < 2) return null;

  const strengthA = (a.wins + 2) / (a.played + 4);
  const strengthB = (b.wins + 2) / (b.played + 4);
  const rawProbabilityA = strengthA / (strengthA + strengthB);
  const probabilityA = Math.min(0.88, Math.max(0.12, rawProbabilityA));
  const probabilityB = 1 - probabilityA;

  const price = (probability: number, played: number): PredictionPrice => ({
    probability,
    decimalOdds: Number((1 / probability).toFixed(2)),
    sampleSize: played,
    basis: "event-form",
  });

  return [price(probabilityA, a.played), price(probabilityB, b.played)];
}
