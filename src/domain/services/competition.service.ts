import { type Competition } from "../competition";
import { type ID, CompetitionStatus, Visibility } from "../types";
import { GetAll, GetWhere, Get, create, update, Delete } from "../../lib/store";
import { generateId } from "../../lib/id";
import { writeAudit } from "../audit";

const COMP_KEY = "competitions";

export class CompetitionService {
  async list(orgId: ID): Promise<Competition[]> {
    return GetWhere<Competition>(COMP_KEY, { organizationId: orgId });
  }

  async get(id: ID): Promise<Competition | undefined> {
    return Get<Competition>(COMP_KEY, id);
  }

  async create(data: {
    organizationId: ID;
    name: string;
    description?: string;
    visibility?: Visibility;
    game?: { name: string; category?: string };
  }, actorId: ID): Promise<Competition> {
    const now = new Date().toISOString();
    const competition: Competition = {
      id: generateId(),
      organizationId: data.organizationId,
      name: data.name,
      description: data.description ?? "",
      visibility: data.visibility ?? Visibility.Public,
      game: data.game,
      status: CompetitionStatus.Draft,
      createdAt: now,
      updatedAt: now,
    };
    const created = await create(COMP_KEY, competition);
    await writeAudit(data.organizationId, actorId, "competition.created", "competition", created.id, {}, created as unknown as Record<string, unknown>);
    return created;
  }

  async update(id: ID, data: Partial<Competition>, actorId: ID): Promise<Competition | undefined> {
    const before = await this.get(id);
    const after = await update<Competition>(COMP_KEY, id, data);
    if (before && after) {
      await writeAudit(before.organizationId, actorId, "competition.updated", "competition", id, before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>);
    }
    return after;
  }

  async duplicate(id: ID, actorId: ID): Promise<Competition | undefined> {
    const original = await this.get(id);
    if (!original) return undefined;
    return this.create({
      organizationId: original.organizationId,
      name: `${original.name} (Copy)`,
      description: original.description,
      visibility: original.visibility,
      game: original.game,
    }, actorId);
  }

  async Delete(id: ID): Promise<boolean> {
    return Delete(COMP_KEY, id);
  }
}
