import { type ID, type Timestamps, CompetitionStatus, Visibility } from "./types";

export interface Competition extends Timestamps {
  id: ID;
  organizationId: ID;
  blueprintId?: ID;
  name: string;
  description: string;
  logoUrl?: string;
  coverImage?: string;
  content?: Record<string, unknown>;
  visibility: Visibility;
  game?: {
    name: string;
    category?: string;
  };
  dateStart?: string;
  dateEnd?: string;
  status: CompetitionStatus;
}
