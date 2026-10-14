import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import type { CompetitionBlockType } from "@/domain/competition-pages";
import { randomUUID } from "node:crypto";

const ALLOWED_BLOCKS = new Set(["hero", "rich_text", "event_list", "schedule", "roster", "standings", "bracket", "results", "statistics", "sponsors", "call_to_action"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { competitionId?: string; pageKind?: string; prompt?: string };
    if (!body.competitionId || !["home", "invite", "live", "custom"].includes(body.pageKind ?? "") || typeof body.prompt !== "string" || body.prompt.trim().length < 4 || body.prompt.length > 1000) {
      return NextResponse.json({ error: "Choose a page, give the AI a short direction, and keep the prompt under 1,000 characters." }, { status: 400 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
    const supabase = createServerClient<Database>(url, anonKey, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in with an organization account to draft a page." }, { status: 401 });
    const { data: rawCompetition } = await supabase.from("competitions").select("id, organization_id, name, description, category").eq("id", body.competitionId).maybeSingle();
    const competition = rawCompetition as { id: string; organization_id: string; name: string; description: string; category: string } | null;
    if (!competition) return NextResponse.json({ error: "Competition not found." }, { status: 404 });
    const { data: rawMembership } = await supabase.from("organization_members").select("role").eq("organization_id", competition.organization_id).eq("member_id", user.id).maybeSingle();
    const membership = rawMembership as { role: string } | null;
    if (!membership || !["owner", "admin"].includes(membership.role)) return NextResponse.json({ error: "Owner or admin access is required to draft competition pages." }, { status: 403 });
    const { data: rawEvents } = await supabase.from("events").select("name, format, status").eq("competition_id", competition.id);
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI page drafting is unavailable until GROQ_API_KEY is configured." }, { status: 503 });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
        temperature: 0.35,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `Draft an editable sports competition web page as JSON only: {"blocks":[{"type":"...","title":"...","body":"..."}]}. Use 3 to 6 blocks from this exact set: ${[...ALLOWED_BLOCKS].join(", ")}. Only use facts in the supplied competition and event data. Do not invent dates, prizes, statistics, rules, sponsors, or eligibility. For unknown details, write a concise question or omit the block. Never create links or claim the page is published.` },
          { role: "user", content: JSON.stringify({ pageKind: body.pageKind, organizerDirection: body.prompt.trim(), competition: { name: competition.name, description: competition.description, category: competition.category }, events: rawEvents ?? [] }) },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return NextResponse.json({ error: "The AI service is temporarily unavailable." }, { status: 502 });
    const result = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = result.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: "The AI returned an empty draft. Try a more specific direction." }, { status: 502 });
    const parsed = JSON.parse(content) as { blocks?: { type?: string; title?: string; body?: string }[] };
    if (!Array.isArray(parsed.blocks)) return NextResponse.json({ error: "The AI returned a draft in an unsupported format." }, { status: 502 });
    const blocks = parsed.blocks.slice(0, 8).flatMap((block) => {
      if (!block.type || !ALLOWED_BLOCKS.has(block.type)) return [];
      return [{ id: randomUUID(), type: block.type as CompetitionBlockType, title: typeof block.title === "string" ? block.title.slice(0, 100) : undefined, body: typeof block.body === "string" ? block.body.slice(0, 1200) : undefined }];
    });
    if (blocks.length === 0) return NextResponse.json({ error: "The AI returned no usable page sections." }, { status: 502 });
    return NextResponse.json({ data: { blocks, saved: false, published: false } });
  } catch (error) {
    console.error("AI page draft failed", error);
    return NextResponse.json({ error: "Could not draft this page. Please try again." }, { status: 500 });
  }
}
