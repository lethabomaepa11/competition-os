import { NextRequest, NextResponse } from "next/server";
import { renderMailEvent, type MailEventPayload } from "@/lib/mail/templates";

type BrevoResponse = {
  messageId?: string;
  messageIds?: string[];
};

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

    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_FROM_EMAIL;
    const senderName = process.env.BREVO_FROM_NAME ?? "CompetitionOS";

    if (!apiKey || !senderEmail) {
      return NextResponse.json(
        { error: "Mail service is not configured", missing: { apiKey: !apiKey, senderEmail: !senderEmail } },
        { status: 503 }
      );
    }

    const rendered = renderMailEvent(body);
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: body.to,
        subject: rendered.subject,
        htmlContent: rendered.htmlContent,
        textContent: rendered.textContent,
        tags: ["competitionos", body.kind],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error: "Brevo send failed", detail: error }, { status: 502 });
    }

    const result = await response.json() as BrevoResponse;
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Mail route error:", error);
    return NextResponse.json({ error: "Internal mail error" }, { status: 500 });
  }
}
