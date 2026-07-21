import { type Invite } from "../invite";
import { type ID } from "../types";
import { GetAll, GetWhere, Get, create, update, Delete } from "../../lib/store";
import { generateId } from "../../lib/id";

const INVITE_KEY = "invites";

export class InviteService {
  async listByOrg(orgId: ID): Promise<Invite[]> {
    return GetWhere<Invite>(INVITE_KEY, { organizationId: orgId });
  }

  async getByToken(token: string): Promise<Invite | undefined> {
    const invites = await GetWhere<Invite>(INVITE_KEY, { token });
    return invites[0];
  }

  async get(id: ID): Promise<Invite | undefined> {
    return Get<Invite>(INVITE_KEY, id);
  }

  async create(orgId: ID, email: string, role: string, invitedBy: ID): Promise<Invite> {
    const token = generateId();
    const invite: Invite = {
      id: generateId(),
      organizationId: orgId,
      email,
      role,
      token,
      status: "pending",
      invitedBy,
      createdAt: new Date().toISOString(),
    };
    return create(INVITE_KEY, invite);
  }

  async accept(token: string, memberId: ID): Promise<Invite | undefined> {
    const invite = await this.getByToken(token);
    if (!invite || invite.status !== "pending") return undefined;
    return update<Invite>(INVITE_KEY, invite.id, {
      status: "accepted",
      acceptedAt: new Date().toISOString(),
    });
  }

  async revoke(id: ID): Promise<Invite | undefined> {
    return update<Invite>(INVITE_KEY, id, { status: "revoked" });
  }

  async Delete(id: ID): Promise<boolean> {
    return Delete(INVITE_KEY, id);
  }
}
