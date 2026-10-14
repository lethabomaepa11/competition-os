import type { Event, Stage, Round } from "../event";
import type { Match } from "../match";
import type { Participant } from "../participant";
import type { RuleOverride, FormatType } from "../types";
import type { StandingsEntry } from "./interface";
import { getFormat } from "./registry";

export interface GroupStageBracketPreview {
  format: FormatType.SingleElimination | FormatType.DoubleElimination;
  participantIds: string[];
  stage: Stage;
  rounds: Round[];
  matches: Match[];
}

/** Build an in-memory knockout projection from the current group table. */
export function createGroupStageBracketPreview(
  event: Event,
  sourceStage: Stage,
  standings: StandingsEntry[],
  participants: Participant[],
  rules: RuleOverride[],
  targetFormat: FormatType,
): GroupStageBracketPreview | null {
  if (targetFormat !== "single_elimination" && targetFormat !== "double_elimination") return null;

  const sourceFormat = getFormat(sourceStage.type);
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const participantIds = sourceFormat.advanceParticipants(sourceStage, standings, rules)
    .filter((id) => participantById.has(id));
  if (participantIds.length < 2) return null;

  const qualifiedParticipants = participantIds.map((id) => participantById.get(id)!);
  const bracket = getFormat(targetFormat).createStages(event.id, qualifiedParticipants, rules)[0];
  if (!bracket) return null;

  return {
    format: targetFormat,
    participantIds,
    stage: bracket.stage,
    rounds: bracket.rounds,
    matches: bracket.matches,
  };
}
