import type { Competition } from "./competition";
import type { Event } from "./event";
import type { RuleOverride } from "./types";
import type { PhaseConfig } from "./progression";

export type BlueprintType = "competition" | "event";

export interface EventBlueprintConfig {
  type: "event";
  event: Pick<Event, "name" | "format" | "participantType" | "registrationPolicy" | "maxParticipants" | "minParticipants" | "config">;
  rules?: RuleOverride[];
  progression?: PhaseConfig[];
}

export interface CompetitionBlueprintConfig {
  type: "competition";
  competition: Pick<Competition, "name" | "description" | "category" | "entryType" | "eligibility" | "visibility" | "game">;
  events: EventBlueprintConfig[];
}

export interface BlueprintRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  config: CompetitionBlueprintConfig | EventBlueprintConfig | Record<string, unknown>;
  version: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt?: string;
}

export function blueprintType(blueprint: BlueprintRecord): BlueprintType {
  if (blueprint.config && "type" in blueprint.config && blueprint.config.type === "event") return "event";
  return "competition";
}

export function isBlueprintCompatible(blueprint: BlueprintRecord, currentVersion = 1): boolean {
  return blueprint.version === currentVersion;
}

export function isEventBlueprint(blueprint: BlueprintRecord): blueprint is BlueprintRecord & { config: EventBlueprintConfig } {
  return blueprintType(blueprint) === "event";
}

export function normalizeEventBlueprint(value: unknown): EventBlueprintConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (record.type === "event" && record.event && typeof record.event === "object") return record as unknown as EventBlueprintConfig;
  if (typeof record.name !== "string" || typeof record.format !== "string") return undefined;
  const event = record as unknown as Event;
  const plan = event.config?.progressionPlan as { phases?: PhaseConfig[] } | undefined;
  return {
    type: "event",
    event: { name: event.name, format: event.format, participantType: event.participantType, registrationPolicy: event.registrationPolicy, minParticipants: event.minParticipants, maxParticipants: event.maxParticipants, config: event.config ?? {} },
    rules: [],
    progression: plan?.phases ?? [],
  };
}

/** Normalizes the original competition+events blueprint shape without changing its stored record. */
export function normalizeCompetitionBlueprint(value: unknown): CompetitionBlueprintConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (!record.competition || typeof record.competition !== "object") return undefined;
  const oldCompetition = record.competition as Competition;
  const events = Array.isArray(record.events) ? record.events.map(normalizeEventBlueprint).filter((item): item is EventBlueprintConfig => !!item) : [];
  return {
    type: "competition",
    competition: { name: oldCompetition.name, description: oldCompetition.description, category: oldCompetition.category, entryType: oldCompetition.entryType, eligibility: oldCompetition.eligibility, visibility: oldCompetition.visibility, game: oldCompetition.game },
    events,
  };
}
