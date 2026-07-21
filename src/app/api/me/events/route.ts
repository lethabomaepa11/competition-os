import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
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

type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CompetitionRow = Database["public"]["Tables"]["competitions"]["Row"];
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

export async function GET(request: NextRequest) {
  try {
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
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: participants, error: partError } = await (supabase.from("participants") as any)
      .select("*")
      .eq("member_id", user.id)
      .eq("status", "active");

    if (partError) return NextResponse.json({ error: (partError as { message: string }).message }, { status: 500 });
    const typedParticipants = (participants ?? []) as ParticipantRow[];
    if (typedParticipants.length === 0) {
      const response = NextResponse.json({ data: [] });
      for (const { name, value } of pendingCookies) response.cookies.set(name, value);
      return response;
    }

    const eventIds = [...new Set(typedParticipants.map((p) => p.event_id))];

    const { data: events, error: evtError } = await (supabase.from("events") as any)
      .select("*")
      .in("id", eventIds);

    if (evtError) return NextResponse.json({ error: (evtError as { message: string }).message }, { status: 500 });
    const typedEvents = (events ?? []) as EventRow[];

    const compIds = [...new Set(typedEvents.map((e) => e.competition_id))];

    const { data: competitions, error: compError } = await (supabase.from("competitions") as any)
      .select("*")
      .in("id", compIds);

    if (compError) return NextResponse.json({ error: (compError as { message: string }).message }, { status: 500 });
    const typedCompetitions = (competitions ?? []) as CompetitionRow[];

    const orgIds = [...new Set(typedCompetitions.map((c) => c.organization_id))];

    const { data: organizations, error: orgError } = await (supabase.from("organizations") as any)
      .select("*")
      .in("id", orgIds);

    if (orgError) return NextResponse.json({ error: (orgError as { message: string }).message }, { status: 500 });
    const typedOrganizations = (organizations ?? []) as OrganizationRow[];

    const compMap = new Map(typedCompetitions.map((c) => [c.id, c]));
    const orgMap = new Map(typedOrganizations.map((o) => [o.id, o]));

    const result = typedParticipants.map((p) => {
      const evt = typedEvents.find((e) => e.id === p.event_id);
      const comp = evt ? compMap.get(evt.competition_id) : undefined;
      const org = comp ? orgMap.get(comp.organization_id) : undefined;
      return {
        participantId: p.id,
        eventId: p.event_id,
        eventName: evt?.name ?? "Unknown Event",
        eventStatus: evt?.status ?? "unknown",
        eventFormat: evt?.format ?? "unknown",
        competitionId: comp?.id ?? "",
        competitionName: comp?.name ?? "Unknown Competition",
        organizationId: org?.id ?? "",
        organizationName: org?.name ?? "Unknown Organization",
        organizationSlug: org?.slug ?? "",
        registeredAt: p.registered_at,
      };
    });

    const response = NextResponse.json({ data: result });
    for (const { name, value } of pendingCookies) response.cookies.set(name, value);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
