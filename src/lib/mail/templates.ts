export type MailRecipient = {
  email: string;
  name?: string;
};

export type MailEventKind =
  | "account_created"
  | "organization_invite"
  | "competition_invite_created"
  | "participant_invite"
  | "participant_registered"
  | "participant_dropped"
  | "competition_published"
  | "competition_started"
  | "competition_completed"
  | "competition_archived"
  | "event_created"
  | "event_started"
  | "event_completed"
  | "event_cancelled"
  | "match_scheduled"
  | "match_started"
  | "match_result_submitted"
  | "match_disputed"
  | "match_dispute_resolved"
  | "bracket_generated"
  | "standings_updated"
  | "bet_placed"
  | "bet_settled";

export type MailEventPayload = {
  kind: MailEventKind;
  to: MailRecipient[];
  params: Record<string, string | number | boolean | null | undefined>;
  actionUrl?: string;
};

type RenderedMail = {
  subject: string;
  htmlContent: string;
  textContent: string;
};

const subjects: Record<MailEventKind, string> = {
  account_created: "Your CompetitionOS account is ready",
  organization_invite: "You have been invited to {{organizationName}}",
  competition_invite_created: "Competition invite link created for {{competitionName}}",
  participant_invite: "You have been invited to compete in {{eventName}}",
  participant_registered: "Registration confirmed for {{eventName}}",
  participant_dropped: "Participant dropped from {{eventName}}",
  competition_published: "{{competitionName}} is published",
  competition_started: "{{competitionName}} has started",
  competition_completed: "{{competitionName}} is complete",
  competition_archived: "{{competitionName}} was archived",
  event_created: "New event created: {{eventName}}",
  event_started: "{{eventName}} has started",
  event_completed: "{{eventName}} is complete",
  event_cancelled: "{{eventName}} was cancelled",
  match_scheduled: "Match scheduled: {{matchName}}",
  match_started: "Match started: {{matchName}}",
  match_result_submitted: "Result submitted: {{matchName}}",
  match_disputed: "Match disputed: {{matchName}}",
  match_dispute_resolved: "Match dispute resolved: {{matchName}}",
  bracket_generated: "Bracket generated for {{eventName}}",
  standings_updated: "Standings updated for {{eventName}}",
  bet_placed: "Bet placed on {{matchName}}",
  bet_settled: "Bet settled for {{matchName}}",
};

const descriptions: Record<MailEventKind, string> = {
  account_created: "Your account has been created. Your temporary password is: {{password}}. Sign in and change your password right away.",
  organization_invite: "You have been invited to join {{organizationName}} as {{role}}.",
  competition_invite_created: "A shareable competition invite link was created for {{competitionName}}.",
  participant_invite: "{{inviterName}} invited you to participate in {{eventName}}.",
  participant_registered: "{{participantName}}, your registration for {{eventName}} is confirmed.",
  participant_dropped: "{{participantName}} was marked as dropped from {{eventName}}.",
  competition_published: "{{competitionName}} is now visible to its intended audience.",
  competition_started: "{{competitionName}} is now in progress.",
  competition_completed: "{{competitionName}} has been marked complete.",
  competition_archived: "{{competitionName}} has been archived.",
  event_created: "{{eventName}} was created inside {{competitionName}}.",
  event_started: "{{eventName}} is now live.",
  event_completed: "{{eventName}} has been completed.",
  event_cancelled: "{{eventName}} has been cancelled.",
  match_scheduled: "{{matchName}} is scheduled for {{scheduledAt}}.",
  match_started: "{{matchName}} has started.",
  match_result_submitted: "A result was submitted for {{matchName}}. Winner: {{winnerName}}.",
  match_disputed: "{{matchName}} has been marked as disputed.",
  match_dispute_resolved: "The dispute for {{matchName}} has been resolved.",
  bracket_generated: "Fixtures and brackets are ready for {{eventName}}.",
  standings_updated: "The standings for {{eventName}} were recalculated.",
  bet_placed: "{{betterName}} placed a bet on {{matchName}}.",
  bet_settled: "A bet on {{matchName}} was settled.",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fillTemplate(template: string, params: MailEventPayload["params"]): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined || value === null || value === "" ? "CompetitionOS" : escapeHtml(value);
  });
}

export function renderMailEvent(payload: MailEventPayload): RenderedMail {
  const subject = fillTemplate(subjects[payload.kind], payload.params);
  const description = fillTemplate(descriptions[payload.kind], payload.params);
  const actionLabel = escapeHtml(String(payload.params.actionLabel ?? "Open CompetitionOS"));
  const actionUrl = payload.actionUrl ? escapeHtml(payload.actionUrl) : "";
  const preheader = escapeHtml(subject);

  const htmlContent = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 24px 12px;">
                <div style="font-size:13px;font-weight:700;color:#1e3a8a;text-transform:uppercase;letter-spacing:.04em;">CompetitionOS</div>
                <h1 style="font-size:24px;line-height:1.25;margin:10px 0 0;color:#0f172a;">${escapeHtml(subject)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 24px;">
                <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#334155;">${description}</p>
                ${actionUrl ? `<a href="${actionUrl}" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;font-weight:700;padding:11px 16px;border-radius:8px;">${actionLabel}</a>` : ""}
                <p style="font-size:12px;line-height:1.5;margin:24px 0 0;color:#64748b;">This is an automated transactional email from CompetitionOS.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textContent = [
    subject,
    "",
    description.replace(/&#039;/g, "'"),
    payload.actionUrl ? `\n${actionLabel}: ${payload.actionUrl}` : "",
    "",
    "CompetitionOS",
  ].join("\n");

  return { subject, htmlContent, textContent };
}
