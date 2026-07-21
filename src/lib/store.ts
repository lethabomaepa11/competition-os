import {
  GetAll as repoGetAll,
  Get as repoGetById,
  create as repoCreate,
  update as repoUpdate,
  Delete as repoRemove,
  query as repoQuery,
  GetWhere as repoGetWhere,
  GetWhereIn as repoGetWhereIn,
} from "./supabase/repository";

export async function GetAll<T extends { id: string }>(key: string): Promise<T[]> {
  return repoGetAll<T>(key);
}

export async function GetWhere<T extends { id: string }>(key: string, criteria: Record<string, unknown>): Promise<T[]> {
  return repoGetWhere<T>(key, criteria);
}

export async function GetWhereIn<T extends { id: string }>(key: string, field: string, values: string[]): Promise<T[]> {
  return repoGetWhereIn<T>(key, field, values);
}

export async function Get<T extends { id: string }>(key: string, id: string): Promise<T | undefined> {
  return repoGetById<T>(key, id);
}

export async function create<T extends { id: string }>(key: string, item: T): Promise<T> {
  return repoCreate<T>(key, item);
}

export async function update<T extends { id: string }>(key: string, id: string, updates: Partial<T>): Promise<T | undefined> {
  return repoUpdate<T>(key, id, updates);
}

export async function Delete(key: string, id: string): Promise<boolean> {
  return repoRemove(key, id);
}

export async function query<T extends { id: string }>(key: string, predicate: ((item: T) => boolean) | Record<string, unknown>): Promise<T[]> {
  return repoQuery<T>(key, predicate);
}
