import { type ID, type Timestamps, type RuleDefinition, type RuleOverride, FormatType, RuleValueType } from "./types";

export interface RuleSet extends Timestamps {
  id: ID;
  eventId: ID;
  name: string;
  rules: RuleOverride[];
}

export const FormatRuleDefinitions: Record<FormatType, RuleDefinition[]> = {
  [FormatType.League]: [
    { key: "scoring", label: "Match Scoring", type: RuleValueType.Selection, defaultValue: "winner_only", options: ["winner_only", "best_of_3", "best_of_5", "best_of_7", "standard"] },
    { key: "win_points", label: "Win Points", type: RuleValueType.Number, defaultValue: 3, validation: { min: 0, max: 100 } },
    { key: "draw_points", label: "Draw Points", type: RuleValueType.Number, defaultValue: 1, validation: { min: 0, max: 100 } },
    { key: "loss_points", label: "Loss Points", type: RuleValueType.Number, defaultValue: 0, validation: { min: 0, max: 100 } },
    { key: "goal_difference", label: "Goal Difference Tiebreaker", type: RuleValueType.Boolean, defaultValue: true },
    { key: "head_to_head", label: "Head-to-Head Tiebreaker", type: RuleValueType.Boolean, defaultValue: true },
    { key: "goals_scored", label: "Goals Scored Tiebreaker", type: RuleValueType.Boolean, defaultValue: false },
    { key: "rounds", label: "Number of Rounds", type: RuleValueType.Selection, defaultValue: "single", options: ["single", "double"] },
    { key: "qualification_count", label: "Qualifiers to Next Stage", type: RuleValueType.Number, defaultValue: 4, validation: { min: 0, max: 64 } },
  ],
  [FormatType.SingleElimination]: [
    { key: "scoring", label: "Match Scoring", type: RuleValueType.Selection, defaultValue: "winner_only", options: ["winner_only", "best_of_3", "best_of_5", "best_of_7", "standard"] },
    { key: "seeding", label: "Seeding", type: RuleValueType.Boolean, defaultValue: true },
    { key: "third_place_match", label: "Third Place Match", type: RuleValueType.Boolean, defaultValue: true },
    { key: "bye_handling", label: "BYE Handling", type: RuleValueType.Selection, defaultValue: "auto_advance", options: ["auto_advance", "bye_win"] },
  ],
  [FormatType.DoubleElimination]: [
    { key: "scoring", label: "Match Scoring", type: RuleValueType.Selection, defaultValue: "winner_only", options: ["winner_only", "best_of_3", "best_of_5", "best_of_7", "standard"] },
    { key: "seeding", label: "Seeding", type: RuleValueType.Boolean, defaultValue: true },
    { key: "bracket_reset", label: "Bracket Reset in Finals", type: RuleValueType.Boolean, defaultValue: true },
    { key: "third_place_match", label: "Third Place Match", type: RuleValueType.Boolean, defaultValue: true },
    { key: "bye_handling", label: "BYE Handling", type: RuleValueType.Selection, defaultValue: "auto_advance", options: ["auto_advance", "bye_win"] },
  ],
  [FormatType.Swiss]: [
    { key: "rounds", label: "Number of Rounds", type: RuleValueType.Number, defaultValue: 5, validation: { min: 1, max: 20 } },
    { key: "win_points", label: "Win Points", type: RuleValueType.Number, defaultValue: 1, validation: { min: 0, max: 10 } },
    { key: "draw_points", label: "Draw Points", type: RuleValueType.Number, defaultValue: 0.5, validation: { min: 0, max: 10 } },
    { key: "qualification_count", label: "Qualifiers to Next Stage", type: RuleValueType.Number, defaultValue: 8, validation: { min: 0, max: 64 } },
  ],
  [FormatType.GroupStage]: [
    { key: "group_count", label: "Number of Groups", type: RuleValueType.Number, defaultValue: 4, validation: { min: 2, max: 32 } },
    { key: "qualifiers_per_group", label: "Qualifiers Per Group", type: RuleValueType.Number, defaultValue: 2, validation: { min: 1, max: 16 } },
    { key: "win_points", label: "Win Points", type: RuleValueType.Number, defaultValue: 3, validation: { min: 0, max: 100 } },
    { key: "draw_points", label: "Draw Points", type: RuleValueType.Number, defaultValue: 1, validation: { min: 0, max: 100 } },
    { key: "double_round_robin", label: "Home & Away Fixtures", type: RuleValueType.Boolean, defaultValue: false },
  ],
  [FormatType.Ladder]: [
    { key: "challenge_window", label: "Challenge Window (hours)", type: RuleValueType.Number, defaultValue: 48, validation: { min: 1, max: 720 } },
    { key: "positions_above", label: "Positions Above You Can Challenge", type: RuleValueType.Number, defaultValue: 3, validation: { min: 1, max: 10 } },
    { key: "win_points", label: "Win Points", type: RuleValueType.Number, defaultValue: 1, validation: { min: 0, max: 100 } },
  ],
  [FormatType.Championship]: [
    { key: "points_1st", label: "1st Place Points", type: RuleValueType.Number, defaultValue: 10, validation: { min: 0, max: 1000 } },
    { key: "points_2nd", label: "2nd Place Points", type: RuleValueType.Number, defaultValue: 7, validation: { min: 0, max: 1000 } },
    { key: "points_3rd", label: "3rd Place Points", type: RuleValueType.Number, defaultValue: 5, validation: { min: 0, max: 1000 } },
    { key: "points_4th", label: "4th Place Points", type: RuleValueType.Number, defaultValue: 3, validation: { min: 0, max: 1000 } },
    { key: "participation_points", label: "Participation Points", type: RuleValueType.Number, defaultValue: 1, validation: { min: 0, max: 100 } },
    { key: "qualification_count", label: "Finals Qualification Count", type: RuleValueType.Number, defaultValue: 4, validation: { min: 0, max: 64 } },
  ],
};

export function getRuleValue(rules: RuleOverride[], key: string, format: FormatType): unknown {
  const override = rules.find((r) => r.key === key);
  if (override !== undefined) return override.value;
  const def = FormatRuleDefinitions[format].find((d) => d.key === key);
  return def?.defaultValue;
}

export function getNumberRule(rules: RuleOverride[], key: string, format: FormatType): number {
  return Number(getRuleValue(rules, key, format)) || 0;
}

export function getBoolRule(rules: RuleOverride[], key: string, format: FormatType): boolean {
  return Boolean(getRuleValue(rules, key, format));
}

export function getStringRule(rules: RuleOverride[], key: string, format: FormatType): string {
  return String(getRuleValue(rules, key, format) ?? "");
}
