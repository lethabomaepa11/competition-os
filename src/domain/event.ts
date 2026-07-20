import { type ID, type Timestamps, EventStatus, FormatType, ParticipantType, RegistrationPolicy } from "./types";

export interface Stage extends Timestamps {
  id: ID;
  eventId: ID;
  name: string;
  type: string;
  orderIndex: number;
  config: Record<string, unknown>;
}

export interface Round extends Timestamps {
  id: ID;
  stageId: ID;
  name: string;
  roundNumber: number;
  config: Record<string, unknown>;
}

export interface Event extends Timestamps {
  id: ID;
  competitionId: ID;
  name: string;
  format: FormatType;
  participantType: ParticipantType;
  maxParticipants?: number;
  minParticipants?: number;
  status: EventStatus;
  registrationPolicy: RegistrationPolicy;
  config: Record<string, unknown>;
  dateStart?: string;
  dateEnd?: string;
  coverImage?: string;
}
