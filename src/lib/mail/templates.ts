export type MailRecipient = {
  email: string;
  name?: string;
};

export type MailEventKind =
  | "account_created"
  | "organization_invite"
  | "competition_invite_created"
  | "participant_invite"
  | "team_invite"
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
  | "bet_settled"
  | "player_match_scheduled"
  | "player_match_started"
  | "player_match_result"
  | "player_next_match"
  | "player_qualified"
  | "player_not_qualified";

export type MailEventPayload = {
  kind: MailEventKind;
  to: MailRecipient[];
  params: Record<string, string | number | boolean | null | undefined>;
  actionUrl?: string;
  /** Label/value rows shown in a summary card under the message. */
  details?: { label: string; value: string }[];
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
  team_invite: "Join {{teamName}} on CompetitionOS",
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
  player_match_scheduled: "Match scheduled: {{matchName}}",
  player_match_started: "You're up: {{matchName}}",
  player_match_result: "Result: {{scoreline}}",
  player_next_match: "Your next opponent: {{matchName}}",
  player_qualified: "You've qualified for the {{roundName}} of {{eventName}}",
  player_not_qualified: "{{eventName}}: the knockout bracket is set",
};

const descriptions: Record<MailEventKind, string> = {
  account_created: "Your account has been created. Your temporary password is: {{password}}. Sign in and change your password right away.",
  organization_invite: "{{inviterName}} invited you to join {{organizationName}} as {{role}}. Review the organization and your access before accepting.",
  competition_invite_created: "A shareable competition invite link was created for {{competitionName}}.",
  participant_invite: "{{inviterName}} invited you to participate in {{eventName}}.",
  team_invite: "{{inviterName}} invited you to join the {{teamName}} roster.",
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
  player_match_scheduled: "{{message}}",
  player_match_started: "{{message}}",
  player_match_result: "{{message}}",
  player_next_match: "{{message}}",
  player_qualified: "{{message}}",
  player_not_qualified: "{{message}}",
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
  const details = payload.details ?? [];
  const detailsHtml = details.length > 0
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f4f8ff;border:1px solid #d6e4ff;border-radius:10px;">${details.map((row, index) => `<tr><td style="padding:10px 16px;${index > 0 ? "border-top:1px solid #e3ecfb;" : ""}font-size:11px;color:#667992;text-transform:uppercase;letter-spacing:.08em;width:38%;">${escapeHtml(row.label)}</td><td style="padding:10px 16px;${index > 0 ? "border-top:1px solid #e3ecfb;" : ""}font-size:15px;font-weight:700;color:#14243a;">${escapeHtml(row.value)}</td></tr>`).join("")}</table>`
    : "";
  const footer = payload.kind.includes("invite")
    ? "This is an automated transactional email from CompetitionOS. If you weren’t expecting this invitation, you can ignore it."
    : "This is an automated transactional email from CompetitionOS, sent because you take part in this competition.";

  const htmlContent = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:#eef3fa;color:#14243a;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3fa;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dce5f1;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:#102744;border-bottom:4px solid #2878f0;">
                <div style="font-size:13px;font-weight:700;color:#ffffff;letter-spacing:.08em;">COMPETITION<span style="color:#79aaff;">OS</span></div>
                <div style="font-size:12px;color:#b9c9df;margin-top:20px;text-transform:uppercase;letter-spacing:.12em;">Competition operations</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 28px;">
                <h1 style="font-size:26px;line-height:1.2;margin:0 0 14px;color:#14243a;">${escapeHtml(subject)}</h1>
                <p style="font-size:15px;line-height:1.7;margin:0 0 24px;color:#52627a;">${description}</p>
                ${payload.kind === "organization_invite" && payload.params.role ? `<div style="margin:0 0 24px;padding:14px 16px;background:#f4f8ff;border:1px solid #d6e4ff;border-radius:10px;"><div style="font-size:11px;color:#667992;text-transform:uppercase;letter-spacing:.08em;">Organization access</div><div style="margin-top:5px;color:#155eef;font-size:16px;font-weight:700;">${escapeHtml(payload.params.role)} · ${escapeHtml(payload.params.organizationName ?? "Organization")}</div></div>` : ""}
                ${detailsHtml}
                ${actionUrl ? `<a href="${actionUrl}" style="display:inline-block;background:#155eef;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:9px;">${actionLabel}</a>` : ""}
                ${actionUrl ? `<p style="font-size:12px;line-height:1.6;margin:22px 0 0;color:#667992;">If the button doesn’t open, copy this secure link:<br /><a href="${actionUrl}" style="color:#155eef;word-break:break-all;">${actionUrl}</a></p>` : ""}
                <p style="font-size:12px;line-height:1.5;margin:25px 0 0;padding-top:18px;border-top:1px solid #e7edf5;color:#7b8aa0;">${footer}</p>
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
    ...details.map((row) => `${row.label}: ${row.value}`),
    payload.actionUrl ? `\n${actionLabel}: ${payload.actionUrl}` : "",
    "",
    "CompetitionOS",
  ].join("\n");

  return { subject, htmlContent, textContent };
}
