import { expect, test, type Page, type Route } from "@playwright/test";

const member = { id: "00000000-0000-4000-8000-000000000001", email: "alex@league.com", displayName: "Alex Morgan", createdAt: "2026-01-01T00:00:00.000Z" };
const organization = { id: "00000000-0000-4000-8000-000000000010", name: "Continental League", slug: "continental-league", settings: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

async function json(route: Route, data: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
}

async function mockApp(page: Page, authenticated = true, accountType: "operator" | "team" | "player" = "team") {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/auth/session") return json(route, { data: { user: authenticated ? { id: member.id, email: member.email, displayName: member.displayName, accountType, organizationSlug: accountType === "operator" ? organization.slug : null } : null } });
    if (path === "/api/me/events") return json(route, { data: [{ participantId: "part-1", eventId: "evt-1", eventName: "Champions Cup", eventStatus: "in_progress", eventFormat: "group_stage", competitionId: "comp-1", competitionName: "2026 Continental Cup", organizationId: organization.id, organizationName: organization.name, organizationSlug: organization.slug, registeredAt: "2026-09-02T12:00:00.000Z" }] });
    if (path === "/api/me/performance") return json(route, { data: { summary: { events: 2, played: 19, wins: 14, draws: 2, losses: 3, winRate: 74, scored: 38, conceded: 17 }, entries: [{ participantId: "part-1", displayName: "Alex Morgan", status: "active", seed: 3, eventName: "Champions Cup", eventStatus: "in_progress", competitionName: "2026 Continental Cup" }], recentMatches: [{ id: "match-1", eventName: "Champions Cup", competitionName: "2026 Continental Cup", organizationName: organization.name, organizationSlug: organization.slug, competitionId: "comp-1", scheduledAt: "2026-10-12T18:00:00.000Z", status: "completed", ownScore: 3, otherScore: 1, result: "win" }] } });
    if (path === "/api/me/teams") return json(route, { data: [{ id: "team-1", name: "Jozi Titans", category: "football", teamType: "club", description: "Premier division club", canManage: true, members: [{ id: member.id, email: member.email, display_name: member.displayName, captain: true }, { id: "member-2", email: "lee@league.com", display_name: "Jordan Lee", captain: false }] }] });
    if (path.includes("/members/crud/GetWhere")) return json(route, { data: [{ ...member, accountType }] });
    if (path.includes("/members/crud/GetAll")) return json(route, { data: [{ ...member, accountType }] });
    if (path.includes("/organizations/crud/GetAll")) return json(route, { data: [organization] });
    if (path.includes("/competitions/crud/GetWhere")) return json(route, { data: [] });
    if (path.includes("/org_members/crud/GetWhere")) return json(route, { data: [{ id: "om-1", organizationId: organization.id, memberId: member.id, role: "owner", permissions: [], joinedAt: "2026-01-01T00:00:00.000Z" }] });
    if (path.includes("/members/crud/Get")) return json(route, { data: member });
    return json(route, { data: [] });
  });
}

test.describe("public product story", () => {
  test("explains organizers, teams, and players without layout overflow", async ({ page }) => {
    await mockApp(page, false);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Run competitions at professional scale/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Control the operation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Own the roster" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "See your game" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your record follows you." })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("presents a focused sign in path", async ({ page }) => {
    await mockApp(page, false);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("separates operator, team, and player onboarding", async ({ page }) => {
    await mockApp(page, false);
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create your account." })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await page.getByLabel("Your name").fill("Alex Morgan");
    await page.getByLabel("Email address").fill("alex@league.com");
    await page.getByLabel("Password").fill("competition2026");
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByRole("heading", { name: "How will you use CompetitionOS?" })).toBeVisible();
    await page.getByRole("radio", { name: /Competition operator/ }).click();
    await expect(page.getByLabel("Company or organization name")).toBeVisible();
    await page.getByRole("radio", { name: /Team owner or captain/ }).click();
    await expect(page.getByLabel("Team name")).toBeVisible();
    await expect(page.getByLabel("Sport or category")).toBeVisible();
    await page.getByRole("radio", { name: /Individual player/ }).click();
    await expect(page.getByLabel("Team name")).toHaveCount(0);
    await expect(page.getByLabel("Company or organization name")).toHaveCount(0);
  });

  test("uses an invitation redirect instead of asking for a role", async ({ page }) => {
    await mockApp(page, false);
    await page.goto("/register?redirect=%2Finvite%2Fteam%2Fabc123");
    await expect(page.getByText("Invitation access")).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Create account and continue/ })).toBeVisible();
  });

  test("publishes complete task guides", async ({ page }) => {
    await mockApp(page, false);
    await page.goto("/how-to");
    await expect(page.getByRole("heading", { name: "Run the complete competition lifecycle." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Score a match and advance it safely." })).toBeVisible();
  });
});

test.describe("authenticated participant workspace", () => {
  test.beforeEach(async ({ page }) => { await mockApp(page); });

  test("shows personal performance and match history", async ({ page }) => {
    await page.goto("/app/performance");
    await expect(page.getByRole("heading", { name: "Your performance." })).toBeVisible();
    await expect(page.getByText("74%", { exact: true })).toBeVisible();
    await expect(page.getByText("Champions Cup", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("3 : 1")).toBeVisible();
  });

  test("shows captain roster controls", async ({ page }) => {
    await page.goto("/app/teams");
    await expect(page.getByRole("heading", { name: "Team and roster" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Jozi Titans" })).toBeVisible();
    await page.getByRole("button", { name: "Manage" }).click();
    await expect(page.getByText("Jordan Lee")).toBeVisible();
    await expect(page.getByPlaceholder("player@email.com")).toBeVisible();
  });

  test("requires a meaningful competition description", async ({ page }) => {
    await page.unroute("**/api/**");
    await mockApp(page, true, "operator");
    await page.goto(`/o/${organization.slug}/competitions/new`);
    await page.getByLabel("Competition name").fill("Continental Cup");
    await page.getByRole("button", { name: /Create competition/ }).click();
    const description = page.getByLabel("Competition description");
    await expect(description).toHaveAttribute("aria-invalid", "true");
    await description.fill("A season for the best clubs across the continent.");
    await expect(page.locator("aside").getByText("A season for the best clubs across the continent.", { exact: true })).toBeVisible();
  });
});
