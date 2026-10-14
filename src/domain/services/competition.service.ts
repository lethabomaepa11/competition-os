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
    description: string;
    visibility?: Visibility;
    game?: { name: string; category?: string };
  }, actorId: ID): Promise<Competition> {
    const name = data.name.trim();
    const description = data.description.trim();
    if (name.length < 3 || name.length > 90) throw new Error("Competition names must contain 3 to 90 characters");
    if (description.length < 20 || description.length > 600) throw new Error("Competition descriptions must contain 20 to 600 characters");
    const now = new Date().toISOString();
    const competition: Competition = {
      id: generateId(),
      organizationId: data.organizationId,
      name,
      description,
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
    if (data.name !== undefined) {
      data.name = data.name.trim();
      if (data.name.length < 3 || data.name.length > 90) throw new Error("Competition names must contain 3 to 90 characters");
    }
    if (data.description !== undefined) {
      data.description = data.description.trim();
      if (data.description.length < 20 || data.description.length > 600) throw new Error("Competition descriptions must contain 20 to 600 characters");
    }
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
