import { type Organization, type Member, type OrganizationMember } from "../organization";
import { type ID, Role } from "../types";
import { GetAll, GetWhere, Get, create, update, Delete } from "../../lib/store";
import { generateId } from "../../lib/id";

const ORG_KEY = "organizations";
const MEMBER_KEY = "members";
const ORG_MEMBER_KEY = "org_members";

export class OrganizationService {
  async list(): Promise<Organization[]> {
    return GetAll<Organization>(ORG_KEY);
  }

  async get(id: ID): Promise<Organization | undefined> {
    return Get<Organization>(ORG_KEY, id);
  }

  async getBySlug(slug: string): Promise<Organization | undefined> {
    const orgs = await GetWhere<Organization>(ORG_KEY, { slug });
    return orgs[0];
  }

  async create(data: { name: string; slug: string }): Promise<Organization> {
    const now = new Date().toISOString();
    const org: Organization = {
      id: generateId(),
      name: data.name,
      slug: data.slug,
      settings: {},
      createdAt: now,
      updatedAt: now,
    };
    return create(ORG_KEY, org);
  }

  async update(id: ID, data: Partial<Organization>): Promise<Organization | undefined> {
    return update<Organization>(ORG_KEY, id, data);
  }

  async Delete(id: ID): Promise<boolean> {
    return Delete(ORG_KEY, id);
  }

  async getMembers(orgId: ID): Promise<(OrganizationMember & { member: Member | undefined })[]> {
    const orgMembers = await GetWhere<OrganizationMember>(ORG_MEMBER_KEY, { organizationId: orgId });
    const result: (OrganizationMember & { member: Member | undefined })[] = [];
    for (const om of orgMembers) {
      const member = await Get<Member>(MEMBER_KEY, om.memberId);
      result.push({ ...om, member });
    }
    return result;
  }

  async addMember(orgId: ID, memberId: ID, role: Role): Promise<OrganizationMember> {
    const now = new Date().toISOString();
    const orgMember: OrganizationMember = {
      id: generateId(),
      organizationId: orgId,
      memberId,
      role,
      permissions: [],
      joinedAt: now,
    };
    return create(ORG_MEMBER_KEY, orgMember);
  }

  async removeMember(orgId: ID, memberId: ID): Promise<void> {
    const members = await GetWhere<OrganizationMember>(ORG_MEMBER_KEY, { organizationId: orgId, memberId });
    for (const m of members) {
      await Delete(ORG_MEMBER_KEY, m.id);
    }
  }
}

export class MemberService {
  async list(): Promise<Member[]> {
    return GetAll<Member>(MEMBER_KEY);
  }

  async get(id: ID): Promise<Member | undefined> {
    return Get<Member>(MEMBER_KEY, id);
  }

  async getByEmail(email: string): Promise<Member | undefined> {
    const members = await GetWhere<Member>(MEMBER_KEY, { email });
    return members[0];
  }

  async create(data: { email: string; displayName: string; id?: string }): Promise<Member> {
    const member: Member = {
      id: data.id ?? generateId(),
      email: data.email,
      displayName: data.displayName,
      createdAt: new Date().toISOString(),
    };
    return create(MEMBER_KEY, member);
  }

  async update(id: ID, data: Partial<Member>): Promise<Member | undefined> {
    return update<Member>(MEMBER_KEY, id, data);
  }
}
