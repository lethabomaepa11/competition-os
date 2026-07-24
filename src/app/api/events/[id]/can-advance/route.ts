import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { MatchStatus } from "@/domain/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const stageId = searchParams.get("stageId");
    if (!stageId) {
      return NextResponse.json({ error: "stageId is required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    });

    // Check no existing progression link from this stage
    const { data: existingLinks } = await supabase
      .from("progression_links")
      .select("id")
      .eq("event_id", id)
      .eq("source_stage_id", stageId)
      .limit(1);

    if (existingLinks && existingLinks.length > 0) {
      return NextResponse.json({ data: { canAdvance: false, reason: "already_advanced" } });
    }

    // Verify stage exists
    const { data: stage } = await supabase
      .from("stages")
      .select("id")
      .eq("id", stageId)
      .eq("event_id", id)
      .single();

    if (!stage) {
      return NextResponse.json({ data: { canAdvance: false, reason: "stage_not_found" } });
    }

    // Get all round IDs for this stage
    const { data: rounds } = await supabase
      .from("rounds")
      .select("id")
      .eq("stage_id", stageId);

    if (!rounds || rounds.length === 0) {
      return NextResponse.json({ data: { canAdvance: false, reason: "no_rounds" } });
    }

    const roundIds = rounds.map((r) => r.id);

    // Check all matches in these rounds are completed
    const { data: matches } = await supabase
      .from("matches")
      .select("status")
      .in("round_id", roundIds);

    if (!matches || matches.length === 0) {
      return NextResponse.json({ data: { canAdvance: false, reason: "no_matches" } });
    }

    const allDone = matches.every(
      (m) =>
        m.status === MatchStatus.Completed ||
        m.status === MatchStatus.Walkover ||
        m.status === MatchStatus.Cancelled,
    );

    return NextResponse.json({
      data: { canAdvance: allDone, reason: allDone ? null : "matches_incomplete" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
