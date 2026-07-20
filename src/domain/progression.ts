import { type ID, FormatType } from "./types";

export interface PhaseConfig {
  format: FormatType;
  qualifierCount: number;
  name?: string;
}

export interface ProgressionPlan {
  phases: PhaseConfig[];
}

/** Auto-compute the qualifier count for a given format and source participant count.
 *  For knockout formats (Single/Double Elimination), picks the largest power-of-2 ≤ count.
 *  For other formats, picks half the count (even), minimum 2. */
export function autoQualifierCount(count: number, format: FormatType): number {
  if (format === FormatType.SingleElimination || format === FormatType.DoubleElimination) {
    const pow = Math.pow(2, Math.floor(Math.log2(count)));
    return Math.max(2, Math.min(count, pow));
  }
  const half = Math.floor(count / 2);
  const even = half % 2 === 0 ? half : half - 1;
  return Math.max(2, even);
}

export interface ProgressionLink {
  id: ID;
  eventId: ID;
  sourceStageId: ID;
  targetStageId: ID;
  qualifierCount: number;
  status: "pending" | "completed";
  createdAt: string;
}
