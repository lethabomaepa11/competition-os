export async function GetAll<T extends { id: string }>(entity: string): Promise<T[]> {
  const res = await fetch(`/api/${entity}/crud/GetAll`, { method: "POST" });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return (json.data ?? []) as T[];
}

export async function Get<T extends { id: string }>(entity: string, id: string): Promise<T | undefined> {
  const res = await fetch(`/api/${entity}/crud/Get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return (json.data as T | null) ?? undefined;
}

export async function create<T extends { id: string }>(entity: string, item: T): Promise<T> {
  const res = await fetch(`/api/${entity}/crud/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data as T;
}

export async function update<T extends { id: string }>(entity: string, id: string, updates: Partial<T>): Promise<T | undefined> {
  const res = await fetch(`/api/${entity}/crud/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, updates }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return (json.data as T | null) ?? undefined;
}

export async function Delete(entity: string, id: string): Promise<boolean> {
  const res = await fetch(`/api/${entity}/crud/Delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data as boolean;
}

export async function query<T extends { id: string }>(entity: string, predicate: (item: T) => boolean): Promise<T[]> {
  const items = await GetAll<T>(entity);
  return items.filter(predicate);
}
