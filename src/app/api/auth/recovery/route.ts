import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";

type RecoveryBody = { code?: unknown; tokenHash?: unknown; accessToken?: unknown; refreshToken?: unknown };

/**
 * Turns a password-recovery link into a signed-in session, so the reset form can
 * save the new password. Accepts the PKCE code Supabase appends to the link, a
 * token hash from a custom email template, or tokens from a legacy implicit link.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RecoveryBody;
    const response = NextResponse.json({ ok: true });
    const supabase = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    let error: { message: string } | null;
    if (typeof body.code === "string") {
      ({ error } = await supabase.auth.exchangeCodeForSession(body.code));
    } else if (typeof body.tokenHash === "string") {
      ({ error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: body.tokenHash }));
    } else if (typeof body.accessToken === "string" && typeof body.refreshToken === "string") {
      ({ error } = await supabase.auth.setSession({ access_token: body.accessToken, refresh_token: body.refreshToken }));
    } else {
      return NextResponse.json({ error: "This reset link is incomplete. Request a new link." }, { status: 400 });
    }

    if (error) {
      // PKCE links only work in the browser that requested them, where the code verifier cookie lives.
      const message = /verifier|flow state/i.test(error.message)
        ? "Open the reset link in the same browser you requested it from, or request a new link."
        : "This reset link is invalid or has expired. Request a new link.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not verify the reset link" },
      { status: 500 },
    );
  }
}
