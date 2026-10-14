import { renderMailEvent, type MailEventPayload } from "./templates";

export async function deliverMail(payload: MailEventPayload) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_FROM_EMAIL;
  if (!apiKey || !senderEmail) {
    return { ok: false as const, status: 503, error: "Mail service is not configured" };
  }

  const rendered = renderMailEvent(payload);
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { accept: "application/json", "api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      sender: { email: senderEmail, name: process.env.BREVO_FROM_NAME ?? "CompetitionOS" },
      to: payload.to,
      subject: rendered.subject,
      htmlContent: rendered.htmlContent,
      textContent: rendered.textContent,
      tags: ["competitionos", payload.kind],
    }),
  });

  if (!response.ok) {
    return { ok: false as const, status: 502, error: await response.text() };
  }
  return { ok: true as const, ...(await response.json() as { messageId?: string; messageIds?: string[] }) };
}
