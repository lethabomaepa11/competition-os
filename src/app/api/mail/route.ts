import { NextRequest, NextResponse } from "next/server";
import { deliverMail } from "@/lib/mail/send";
import type { MailEventPayload } from "@/lib/mail/templates";

function isValidPayload(body: Partial<MailEventPayload>): body is MailEventPayload {
  return Boolean(
    body.kind &&
    Array.isArray(body.to) &&
    body.to.length > 0 &&
    body.to.every((recipient) => recipient.email) &&
    body.params
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<MailEventPayload>;
    if (!isValidPayload(body)) {
      return NextResponse.json({ error: "Invalid mail payload" }, { status: 400 });
    }

    const result = await deliverMail(body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Mail route error:", error);
    return NextResponse.json({ error: "Internal mail error" }, { status: 500 });
  }
}
