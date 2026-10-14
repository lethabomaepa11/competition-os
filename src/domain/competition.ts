import { type ID, type Timestamps, CompetitionStatus, ParticipantType, Visibility } from "./types";

export interface Competition extends Timestamps {
  id: ID;
  organizationId: ID;
  blueprintId?: ID;
  name: string;
  description: string;
  logoUrl?: string;
  coverImage?: string;
  content?: Record<string, unknown>;
  category: string;
  entryType: ParticipantType;
  eligibility: {
    region?: string;
    minRosterSize?: number;
    maxRosterSize?: number;
    notes?: string;
  };
  visibility: Visibility;
  game?: {
    name: string;
    category?: string;
  };
  dateStart?: string;
  dateEnd?: string;
  publishedAt?: string;
  status: CompetitionStatus;
}
