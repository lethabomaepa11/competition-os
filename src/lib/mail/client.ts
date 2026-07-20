import type { MailEventPayload, MailRecipient } from "./templates";

export function sendMailEvent(payload: MailEventPayload): void {
  if (typeof window === "undefined") return;
  fetch("/api/mail", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.warn("Mail notification failed:", error);
  });
}

export function compactRecipients(recipients: Array<MailRecipient | undefined | null>): MailRecipient[] {
  const seen = new Set<string>();
  return recipients.filter((recipient): recipient is MailRecipient => {
    if (!recipient?.email) return false;
    const key = recipient.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
