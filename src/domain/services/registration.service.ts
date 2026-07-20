import { type Participant } from "../participant";
import { type ID } from "../types";
import { GetAll, Get, create, update, Delete, query } from "../../lib/store";
import { generateId } from "../../lib/id";

const PART_KEY = "participants";

export class RegistrationService {
  async getParticipants(eventId: ID): Promise<Participant[]> {
    return query<Participant>(PART_KEY, (p) => p.eventId === eventId);
  }

  async get(id: ID): Promise<Participant | undefined> {
    return Get<Participant>(PART_KEY, id);
  }

  async register(eventId: ID, memberId: ID, displayName: string, seed?: number): Promise<Participant> {
    const now = new Date().toISOString();
    const participant: Participant = {
      id: generateId(),
      eventId,
      memberId,
      displayName,
      seed,
      status: "active",
      registeredAt: now,
      createdAt: now,
      updatedAt: now,
    };
    return create(PART_KEY, participant);
  }

  async unregister(id: ID): Promise<boolean> {
    return Delete(PART_KEY, id);
  }

  async dropOut(id: ID): Promise<Participant | undefined> {
    return update<Participant>(PART_KEY, id, { status: "dropped_out" });
  }

  async isRegistered(eventId: ID, memberId: ID): Promise<boolean> {
    const results = await query<Participant>(PART_KEY, (p) => p.eventId === eventId && p.memberId === memberId);
    return results.length > 0;
  }

  async count(eventId: ID): Promise<number> {
    const results = await query<Participant>(PART_KEY, (p) => p.eventId === eventId && p.status === "active");
    return results.length;
  }
}
