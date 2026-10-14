import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { validateCompetitionPages } from "@/domain/competition-pages";
import type { Database } from "@/lib/supabase/types";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as { pages?: unknown };
    const validation = validateCompetitionPages(body.pages);
    if (!validation.pages) return NextResponse.json({ error: validation.errors[0], errors: validation.errors }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
    const supabase = createServerClient<Database>(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to update competition pages." }, { status: 401 });

    const { data: rawCompetition } = await supabase.from("competitions").select("id, organization_id").eq("id", id).maybeSingle();
    const competition = rawCompetition as { id: string; organization_id: string } | null;
    if (!competition) return NextResponse.json({ error: "Competition not found." }, { status: 404 });
    const { data: rawMembership } = await supabase.from("organization_members").select("role").eq("organization_id", competition.organization_id).eq("member_id", user.id).maybeSingle();
    const role = (rawMembership as { role?: string } | null)?.role;
    if (!role || !["owner", "admin"].includes(role)) return NextResponse.json({ error: "Owner or admin access is required." }, { status: 403 });

    const { error } = await supabase.from("competitions").update({ pages: validation.pages } as never).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: { pages: validation.pages } });
  } catch (error) {
    console.error("Competition page update failed", error);
    return NextResponse.json({ error: "Could not save competition pages." }, { status: 500 });
  }
}
