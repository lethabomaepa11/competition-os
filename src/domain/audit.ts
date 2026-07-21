import { type ID, type AuditEntry } from "./types";
import { generateId } from "../lib/id";
import { GetWhere, update as storeUpdate, create } from "../lib/store";

const AUDIT_KEY = "audit_entries";

export async function writeAudit(
  organizationId: ID,
  actorId: ID,
  action: string,
  resourceType: string,
  resourceId: ID,
  previousState: Record<string, unknown>,
  newState: Record<string, unknown>,
): Promise<AuditEntry> {
  const entry: AuditEntry = {
    id: generateId(),
    organizationId,
    actorId,
    action,
    resourceType,
    resourceId,
    diff: computeDiff(previousState, newState),
    snapshot: newState,
    metadata: {},
    createdAt: new Date().toISOString(),
  };
  await create(AUDIT_KEY, entry);
  return entry;
}

export async function getAuditLog(
  organizationId: ID,
  options?: { resourceType?: string; resourceId?: ID; limit?: number },
): Promise<AuditEntry[]> {
  let entries = await GetWhere<AuditEntry>(AUDIT_KEY, { organizationId });
  if (options?.resourceType) entries = entries.filter((e) => e.resourceType === options.resourceType);
  if (options?.resourceId) entries = entries.filter((e) => e.resourceId === options.resourceId);
  entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (options?.limit) entries = entries.slice(0, options.limit);
  return entries;
}

export async function undoAudit(auditId: ID): Promise<boolean> {
  const { Get } = await import("../lib/store");
  const entry = await Get<AuditEntry>(AUDIT_KEY, auditId);
  if (!entry) return false;
  await storeUpdate(entry.resourceType, entry.resourceId, entry.snapshot as Record<string, unknown>);
  return true;
}

function computeDiff(prev: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  for (const key of Object.keys({ ...prev, ...next })) {
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
      diff[key] = { from: prev[key], to: next[key] };
    }
  }
  return diff;
}
