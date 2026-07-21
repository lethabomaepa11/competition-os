import { type ParticipantInvite } from "../participant-invite";
import { type ID } from "../types";

const PI_KEY = "participant_invites";

export class ParticipantInviteService {
  private async getRepo() {
    const { GetAll, GetWhere, Get, create, update } = await import("../../lib/supabase/repository");
    return { GetAll, GetWhere, Get, create, update };
  }

  async listByEvent(eventId: ID): Promise<ParticipantInvite[]> {
    const repo = await this.getRepo();
    return repo.GetWhere<ParticipantInvite>(PI_KEY, { eventId });
  }

  async getByToken(token: string): Promise<ParticipantInvite | undefined> {
    const repo = await this.getRepo();
    const all = await repo.GetWhere<ParticipantInvite>(PI_KEY, { token });
    return all[0];
  }

  async get(id: ID): Promise<ParticipantInvite | undefined> {
    const repo = await this.getRepo();
    return repo.Get<ParticipantInvite>(PI_KEY, id);
  }

  async create(eventId: ID, competitionId: ID, email: string, displayName: string, invitedBy: ID): Promise<ParticipantInvite> {
    const repo = await this.getRepo();
    const invite: ParticipantInvite = {
      id: crypto.randomUUID(),
      eventId,
      competitionId,
      email,
      displayName,
      token: crypto.randomUUID().slice(0, 8),
      status: "pending",
      invitedBy,
      createdAt: new Date().toISOString(),
    };
    return repo.create(PI_KEY, invite);
  }

  async accept(token: string): Promise<ParticipantInvite | undefined> {
    const repo = await this.getRepo();
    const invite = await this.getByToken(token);
    if (!invite || invite.status !== "pending") return undefined;
    return repo.update<ParticipantInvite>(PI_KEY, invite.id, {
      status: "accepted",
      acceptedAt: new Date().toISOString(),
    } as Partial<ParticipantInvite>);
  }

  async revoke(id: ID): Promise<ParticipantInvite | undefined> {
    const repo = await this.getRepo();
    return repo.update<ParticipantInvite>(PI_KEY, id, { status: "revoked" } as Partial<ParticipantInvite>);
  }
}
