import { type CompetitionInvite } from "../competition-invite";
import { type ID } from "../types";

const CI_KEY = "competition_invites";

export class CompetitionInviteService {
  private async getRepo() {
    const { GetAll, GetWhere, Get, create, update } = await import("../../lib/supabase/repository");
    return { GetAll, GetWhere, Get, create, update };
  }

  async listByCompetition(compId: ID): Promise<CompetitionInvite[]> {
    const repo = await this.getRepo();
    return repo.GetWhere<CompetitionInvite>(CI_KEY, { competitionId: compId });
  }

  async getByToken(token: string): Promise<CompetitionInvite | undefined> {
    const repo = await this.getRepo();
    const all = await repo.GetWhere<CompetitionInvite>(CI_KEY, { token });
    return all[0];
  }

  async get(id: ID): Promise<CompetitionInvite | undefined> {
    const repo = await this.getRepo();
    return repo.Get<CompetitionInvite>(CI_KEY, id);
  }

  async create(competitionId: ID, organizationId: ID, label: string, createdBy: ID): Promise<CompetitionInvite> {
    const repo = await this.getRepo();
    const invite: CompetitionInvite = {
      id: crypto.randomUUID(),
      competitionId,
      organizationId,
      label,
      token: crypto.randomUUID().slice(0, 8),
      status: "active",
      createdBy,
      createdAt: new Date().toISOString(),
    };
    return repo.create(CI_KEY, invite);
  }

  async toggle(id: ID): Promise<CompetitionInvite | undefined> {
    const repo = await this.getRepo();
    const invite = await this.get(id);
    if (!invite) return undefined;
    return repo.update<CompetitionInvite>(CI_KEY, id, {
      status: invite.status === "active" ? "disabled" : "active",
    } as Partial<CompetitionInvite>);
  }
}
