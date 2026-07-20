export type ID = string;

export enum CompetitionStatus {
  Draft = "draft",
  Published = "published",
  InProgress = "in_progress",
  Completed = "completed",
  Archived = "archived",
}

export enum EventStatus {
  Draft = "draft",
  Open = "open",
  InProgress = "in_progress",
  Completed = "completed",
  Cancelled = "cancelled",
}

export enum MatchStatus {
  Scheduled = "scheduled",
  InProgress = "in_progress",
  Completed = "completed",
  Disputed = "disputed",
  Cancelled = "cancelled",
  Walkover = "walkover",
}

export enum ParticipantType {
  Individual = "individual",
  Team = "team",
}

export enum FormatType {
  League = "league",
  SingleElimination = "single_elimination",
  DoubleElimination = "double_elimination",
  Swiss = "swiss",
  GroupStage = "group_stage",
  Ladder = "ladder",
  Championship = "championship",
}

export enum BracketGroup {
  Winners = "winners",
  Losers = "losers",
  Finals = "finals",
}

export enum Visibility {
  Public = "public",
  Private = "private",
  Hidden = "hidden",
}

export enum RegistrationPolicy {
  Open = "open",
  InviteOnly = "invite_only",
  ApprovalRequired = "approval_required",
  Closed = "closed",
}

export enum Role {
  Owner = "owner",
  Admin = "admin",
  Moderator = "moderator",
  Referee = "referee",
  Member = "member",
}

export enum RuleValueType {
  Number = "number",
  Boolean = "boolean",
  String = "string",
  Selection = "selection",
  Json = "json",
}

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export interface RuleDefinition {
  key: string;
  label: string;
  type: RuleValueType;
  defaultValue: unknown;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    required?: boolean;
    pattern?: string;
  };
}

export interface RuleOverride {
  key: string;
  value: unknown;
}

export interface AuditEntry {
  id: ID;
  organizationId: ID;
  actorId: ID;
  action: string;
  resourceType: string;
  resourceId: ID;
  diff: Record<string, unknown>;
  snapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}
