import { type ID, type Timestamps } from "./types";

export interface Participant extends Timestamps {
  id: ID;
  eventId: ID;
  memberId: ID;
  teamId?: ID;
  displayName: string;
  seed?: number;
  status: "active" | "eliminated" | "dropped_out" | "disqualified";
  registeredAt: string;
}

export interface Team extends Timestamps {
  id: ID;
  name: string;
  memberIds: ID[];
  avatarUrl?: string;
  category: string;
  teamType: string;
  description: string;
}

export type RegistrationStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface CompetitionRegistration extends Timestamps {
  id: ID;
  competitionId: ID;
  registrantType: "individual" | "team";
  memberId?: ID;
  teamId?: ID;
  status: RegistrationStatus;
  registrationNote: string;
  reviewNote: string;
  reviewedBy?: ID;
  reviewedAt?: string;
}
