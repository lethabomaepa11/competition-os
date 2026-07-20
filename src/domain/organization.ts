import { type ID, type Timestamps, Role } from "./types";

export interface OrganizationMember {
  id: ID;
  organizationId: ID;
  memberId: ID;
  role: Role;
  permissions: string[];
  joinedAt: string;
}

export interface Member {
  id: ID;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Organization extends Timestamps {
  id: ID;
  name: string;
  slug: string;
  logoUrl?: string;
  settings: Record<string, unknown>;
}
