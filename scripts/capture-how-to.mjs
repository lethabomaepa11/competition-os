import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:3101";
const output = new URL("../public/how-to/", import.meta.url);
const member = { id: "00000000-0000-4000-8000-000000000001", email: "captain@competitionos.io", displayName: "Alex Morgan", accountType: "team", createdAt: "2026-01-01T00:00:00.000Z" };
const organization = { id: "00000000-0000-4000-8000-000000000010", name: "Continental League", slug: "continental-league", settings: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const team = { id: "team-1", name: "Jozi Titans", category: "football", teamType: "club", description: "Senior football club competing across regional and national events.", canManage: true, members: [{ id: member.id, email: member.email, display_name: member.displayName, captain: true }, { id: "player-2", email: "jordan@titans.co.za", display_name: "Jordan Lee", captain: false }, { id: "player-3", email: "sam@titans.co.za", display_name: "Sam Nkosi", captain: false }] };

async function installMocks(page, accountType) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const send = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/api/auth/session") return send({ data: accountType ? { user: { ...member, accountType, organizationSlug: accountType === "operator" ? organization.slug : null } } : null });
    if (path === "/api/me/teams") return send({ data: [team] });
    if (path === "/api/me/opportunities") return send({ data: { alertCount: 2, opportunities: [{ id: "comp-1", name: "Southern Champions Cup", description: "A national club championship with regional qualification and a knockout final series.", category: "football", entryType: "team", eligibility: { region: "South Africa", minRosterSize: 3, maxRosterSize: 24 }, dateStart: "2026-11-14T10:00:00.000Z", publishedAt: "2026-10-12T10:00:00.000Z", isNew: true, organization: { name: organization.name, slug: organization.slug }, eligibleTeams: [{ id: team.id, name: team.name, rosterSize: 3 }], applications: [], canApply: true }, { id: "comp-2", name: "Premier Futsal Series", description: "A structured futsal season for registered clubs.", category: "futsal", entryType: "team", eligibility: {}, dateStart: "2026-12-01T10:00:00.000Z", publishedAt: "2026-10-11T10:00:00.000Z", isNew: true, organization: { name: "National Futsal Association" }, eligibleTeams: [], applications: [], canApply: false }] } });
    if (path === `/api/o/${organization.slug}/registrations`) return send({ data: [{ id: "reg-1", registrantType: "team", status: "pending", registrationNote: "Regional champions, 2026 season.", createdAt: "2026-10-12T10:00:00.000Z", competition: { id: "comp-1", name: "Southern Champions Cup", category: "football" }, team: { name: team.name, team_type: "club", member_ids: team.members.map((item) => item.id) }, member: null, targetEvents: [{ id: "event-1", name: "Championship draw" }] }, { id: "reg-2", registrantType: "individual", status: "pending", registrationNote: "Qualified through the regional open.", createdAt: "2026-10-13T10:00:00.000Z", competition: { id: "comp-3", name: "National Esports Open", category: "esports" }, team: null, member: { display_name: "Lebo Mokoena", email: "lebo@example.com" }, targetEvents: [{ id: "event-2", name: "Open bracket" }] }] });
    if (path.includes("/members/crud/GetWhere") || path.includes("/members/crud/GetAll") || path.includes("/members/crud/Get")) return send({ data: path.includes("GetAll") ? [{ ...member, accountType }] : [{ ...member, accountType }] });
    if (path.includes("/organizations/crud/GetAll")) return send({ data: accountType === "operator" ? [organization] : [] });
    if (path.includes("/organizations/crud/GetWhere")) return send({ data: [organization] });
    if (path.includes("/org_members/crud/GetWhere")) return send({ data: [{ id: "membership-1", organizationId: organization.id, memberId: member.id, role: "owner", permissions: [], joinedAt: "2026-01-01T00:00:00.000Z" }] });
    if (path.includes("/competitions/crud/GetWhere")) return send({ data: [] });
    return send({ data: [] });
  });
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

async function capture(name, path, accountType, prepare) {
  const page = await context.newPage();
  await installMocks(page, accountType);
  await page.goto(`${baseURL}${path}`, { waitUntil: "networkidle" });
  if (prepare) await prepare(page);
  await page.screenshot({ path: new URL(`${name}.png`, output).pathname.slice(1), fullPage: false });
  await page.close();
}

await capture("account-onboarding", "/register", null, async (page) => page.getByText("Team", { exact: true }).click());
await capture("create-competition", `/o/${organization.slug}/competitions/new`, "operator");
await capture("registration-review", `/o/${organization.slug}/registrations`, "operator");
await capture("team-roster", "/app/teams", "team");
await capture("tournament-directory", "/app/opportunities", "team");

await browser.close();
