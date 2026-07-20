import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function mapKeys(obj: unknown, convert: (k: string) => string): unknown {
  if (Array.isArray(obj)) return obj.map((v) => mapKeys(v, convert));
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[convert(k)] = mapKeys(v, convert);
    }
    return result;
  }
  return obj;
}

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

const GENERATED_ID_RE = /^[a-z0-9]+-[a-z0-9]+-\d+$/i;

function isGeneratedId(s: string): boolean {
  return GENERATED_ID_RE.test(s);
}

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(payload)) {
    const val = payload[key];
    if (typeof val === "string") {
      if (val === "" || isGeneratedId(val)) {
        payload[key] = null;
      }
    }
  }
  return payload;
}

function stripGeneratedId(payload: Record<string, unknown>): Record<string, unknown> {
  if (typeof payload.id === "string" && !isUuid(payload.id)) {
    const { id, ...rest } = payload;
    return rest;
  }
  return payload;
}

const TABLE_MAP: Record<string, string> = {
  organizations: "organizations",
  members: "profiles",
  org_members: "organization_members",
  competitions: "competitions",
  events: "events",
  stages: "stages",
  rounds: "rounds",
  matches: "matches",
  match_participants: "match_participants",
  participants: "participants",
  teams: "teams",
  rulesets: "rule_sets",
  bets: "bets",
  better_profiles: "better_profiles",
  invites: "invites",
  competition_invites: "competition_invites",
  participant_invites: "participant_invites",
  audit_entries: "audit_entries",
  score_audit_entries: "score_audit_entries",
  match_timings: "match_timings",
  progression_links: "progression_links",
  championship_points: "championship_points",
  blueprints: "blueprints",
  awarded_points: "awarded_points",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string; action: string }> }
) {
  try {
    const { entity, action } = await params;
    const tb = TABLE_MAP[entity];
    if (!tb) {
      return NextResponse.json({ error: `No table mapping for entity: ${entity}` }, { status: 400 });
    }

    const rawBody = await request.text().catch(() => "");
    const body: Record<string, unknown> = rawBody ? JSON.parse(rawBody) : {};
    const { id, item, updates } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          pendingCookies.length = 0;
          pendingCookies.push(...cookiesToSet);
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    let result: unknown;

    switch (action) {
      case "GetAll": {
        const { data, error } = await supabase.from(tb).select("*");
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        result = mapKeys(data ?? [], snakeToCamel);
        break;
      }

      case "Get": {
        const { data, error } = await supabase.from(tb).select("*").eq("id", id as string).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        result = data ? mapKeys(data, snakeToCamel) : null;
        break;
      }

      case "create": {
        if (!item) return NextResponse.json({ error: "Missing item in request body" }, { status: 400 });
        const converted = mapKeys(item, camelToSnake) as Record<string, unknown>;
        const payload = sanitizePayload(stripGeneratedId(converted)) as Record<string, unknown>;
        const { randomUUID } = await import("crypto");
        const rowId = randomUUID();

        if (tb !== "match_participants") {
          payload.id = rowId;
        }

        const { error: insertErr } = await supabase.from(tb).insert(payload as never);
        if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

        if (tb === "organizations" && user) {
          await supabase
            .from("organization_members")
            .insert({ organization_id: rowId, member_id: user.id, role: "owner", permissions: [] } as never);
        }

        result = mapKeys(payload, snakeToCamel);
        break;
      }

      case "update": {
        const converted = mapKeys(updates, camelToSnake) as Record<string, unknown>;
        const payload = sanitizePayload(converted as Record<string, unknown>) as never;
        const { data, error } = await supabase.from(tb).update(payload).eq("id", id as string).select().maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        result = data ? mapKeys(data, snakeToCamel) : null;
        break;
      }

      case "Delete": {
        const { error } = await supabase.from(tb).delete().eq("id", id as string);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        result = true;
        break;
      }

      case "DeleteByMatch": {
        const { matchId } = body;
        if (!matchId) return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
        const { error } = await supabase.from(tb).delete().eq("match_id", matchId as string);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        result = true;
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const response = NextResponse.json({ data: result });
    for (const { name, value } of pendingCookies) {
      response.cookies.set(name, value);
    }
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
