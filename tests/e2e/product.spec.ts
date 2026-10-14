import { expect, test, type Page, type Route } from "@playwright/test";

const member = { id: "00000000-0000-4000-8000-000000000001", email: "alex@league.com", displayName: "Alex Morgan", createdAt: "2026-01-01T00:00:00.000Z" };
const organization = { id: "00000000-0000-4000-8000-000000000010", name: "Continental League", slug: "continental-league", settings: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

async function json(route: Route, data: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
}

async function mockApp(page: Page, authenticated = true, accountType: "operator" | "team" | "player" = "team", profileAccountType: "operator" | "team" | "player" = accountType, availableOrganizations = [organization]) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/auth/session") return json(route, { data: { user: authenticated ? { id: member.id, email: member.email, displayName: member.displayName, accountType, organizationSlug: accountType === "operator" ? organization.slug : null } : null } });
    if (path === "/api/me/events") return json(route, { data: [{ participantId: "part-1", eventId: "evt-1", eventName: "Champions Cup", eventStatus: "in_progress", eventFormat: "group_stage", competitionId: "comp-1", competitionName: "2026 Continental Cup", organizationId: organization.id, organizationName: organization.name, organizationSlug: organization.slug, registeredAt: "2026-09-02T12:00:00.000Z" }] });
    if (path === "/api/me/performance") return json(route, { data: { summary: { events: 2, played: 19, wins: 14, draws: 2, losses: 3, winRate: 74, scored: 38, conceded: 17 }, entries: [{ participantId: "part-1", displayName: "Alex Morgan", status: "active", seed: 3, eventName: "Champions Cup", eventStatus: "in_progress", competitionName: "2026 Continental Cup" }], recentMatches: [{ id: "match-1", eventName: "Champions Cup", competitionName: "2026 Continental Cup", organizationName: organization.name, organizationSlug: organization.slug, competitionId: "comp-1", scheduledAt: "2026-10-12T18:00:00.000Z", status: "completed", ownScore: 3, otherScore: 1, result: "win" }] } });
    if (path === "/api/me/teams") return json(route, { data: [{ id: "team-1", name: "Jozi Titans", category: "football", teamType: "club", description: "Premier division club", canManage: true, members: [{ id: member.id, email: member.email, display_name: member.displayName, captain: true }, { id: "member-2", email: "lee@league.com", display_name: "Jordan Lee", captain: false }] }] });
    if (path.includes("/members/crud/GetWhere")) return json(route, { data: [{ ...member, accountType: profileAccountType }] });
    if (path.includes("/members/crud/GetAll")) return json(route, { data: [{ ...member, accountType: profileAccountType }] });
    if (path.includes("/organizations/crud/GetAll")) return json(route, { data: availableOrganizations });
    if (path.includes("/competitions/crud/GetWhere")) return json(route, { data: [] });
    if (path.includes("/org_members/crud/GetWhere")) return json(route, { data: [{ id: "om-1", organizationId: organization.id, memberId: member.id, role: "owner", permissions: [], joinedAt: "2026-01-01T00:00:00.000Z" }] });
    if (path.includes("/members/crud/Get")) return json(route, { data: member });
    return json(route, { data: [] });
  });
}

test.describe("public product story", () => {
  test("lets a guest submit a named prediction without creating an account", async ({ page }) => {
    await mockApp(page, false);
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/competitions/crud/Get") return json(route, { data: { id: "comp-live", organizationId: organization.id, name: "Continental Cup", description: "Annual cup", category: "football", status: "in_progress", visibility: "public", settings: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } });
      if (path === "/api/events/crud/GetWhere") return json(route, { data: [{ id: "event-live", competitionId: "comp-live", name: "Open Division", format: "league", participantType: "individual", registrationPolicy: "open", status: "in_progress", config: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }] });
      if (path === "/api/stages/crud/GetWhere") return json(route, { data: [{ id: "stage-live", eventId: "event-live", name: "League", type: "league", orderIndex: 0, config: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }] });
      if (path === "/api/rounds/crud/GetWhere") return json(route, { data: [{ id: "round-live", stageId: "stage-live", name: "League", roundNumber: 1, config: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }] });
      if (path === "/api/matches/crud/GetWhere") return json(route, { data: [{ id: "match-live", eventId: "event-live", roundId: "round-live", status: "scheduled", participantIds: ["player-a", "player-b"], participants: [], config: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }] });
      if (path === "/api/match_participants/crud/GetWhereIn") return json(route, { data: [{ matchId: "match-live", participantId: "player-a", position: 1 }, { matchId: "match-live", participantId: "player-b", position: 2 }] });
      if (path === "/api/participants/crud/GetWhere") return json(route, { data: [{ id: "player-a", eventId: "event-live", displayName: "Cape Town City", status: "active", registeredAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }, { id: "player-b", eventId: "event-live", displayName: "Sekhukhune United", status: "active", registeredAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }] });
      if (path === "/api/bets/crud/GetWhere") return json(route, { data: [] });
      if (path === "/api/guest-predictions") return json(route, { ok: true, name: "Sam Supporter", matchId: "match-live", participantId: "player-a", odds: null });
      return route.fallback();
    });
    await page.goto(`/live/${organization.slug}/comp-live`);
    await page.getByRole("tab", { name: /Predictions/ }).click();
    await page.getByLabel("Prediction display name").fill("Sam Supporter");
    await page.getByRole("button", { name: "Cape Town City" }).click();
    await page.getByRole("button", { name: "Save prediction" }).click();
    await expect(page.getByText(/Sam Supporter: Cape Town City/)).toBeVisible();
    await expect(page.getByText(/No account, money or points required/).first()).toBeVisible();
  });

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

  test("uses the CompetitionOS crest in animated workspace loaders", async ({ page }) => {
    await mockApp(page, false);
    await page.goto("/loader-preview");
    await expect(page.locator(".competition-loader-indicator")).toHaveCount(2);
    await expect(page.locator(".competition-loader-orbit--outer")).toHaveCount(2);
    const animation = await page.locator(".competition-loader-bounce").first().evaluate((element) => getComputedStyle(element).animationName);
    expect(animation).toContain("competition-bounce");
    await expect(page.getByRole("heading", { name: "Workspace loading" })).toBeVisible();
  });

  test("shows a qualified-only knockout projection and separate double-elimination paths", async ({ page }) => {
    await mockApp(page, false);
    await page.goto("/bracket-preview");
    await expect(page.getByRole("heading", { name: "Projected knockout draw" })).toBeVisible();
    await expect(page.getByTestId("qualifier-counter")).toContainText("8");
    await expect(page.getByTestId("qualifier-counter")).toContainText("12");
    await expect(page.getByText("Winners pathway")).toBeVisible();
    await expect(page.getByText("Losers pathway")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Grand final", exact: true })).toBeVisible();
    const doubleEliminationView = page.getByRole("region", { name: "Competition bracket" }).nth(1);
    await doubleEliminationView.getByRole("button", { name: "View fixture: Cape Town City versus Sekhukhune United" }).click();
    await expect(page.getByText("Winner advances to")).toBeVisible();
    await expect(page.getByText("Loser drops to")).toBeVisible();
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
    await page.getByRole("radio", { name: /Competition operator/ }).click();
    await page.getByLabel("Company or organization name").fill("Operator Test");
    let registrationBody: Record<string, unknown> | undefined;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/auth/register")) registrationBody = request.postDataJSON();
    });
    await page.getByRole("button", { name: /Create account/ }).click();
    await expect.poll(() => registrationBody).toMatchObject({
      displayName: "Alex Morgan",
      email: "alex@league.com",
      password: "competition2026",
      accountType: "operator",
      organizationName: "Operator Test",
    });
  });

  test("uses an invitation redirect instead of asking for a role", async ({ page }) => {
    await mockApp(page, false);
    await page.goto("/register?redirect=%2Finvite%2Fteam%2Fabc123");
    await expect(page.getByText("Invitation access")).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Create account and continue/ })).toBeVisible();
  });

  test("shows organization invitation details and safely accepts for the invited account", async ({ page }) => {
    await mockApp(page, true, "operator");
    let accepted = false;
    await page.route("**/api/organization-invites/invite-blue", async (route) => {
      if (route.request().method() === "POST") {
        accepted = true;
        return json(route, { data: { organizationId: organization.id } });
      }
      return json(route, { data: { organizationId: organization.id, organizationName: organization.name, organizationSlug: organization.slug, email: member.email, role: "admin", status: "pending", inviterName: "Morgan Lee" } });
    });
    await page.goto("/invite/invite-blue");
    await expect(page.getByRole("heading", { name: "Join the organization." })).toBeVisible();
    await expect(page.getByText(organization.name, { exact: true })).toBeVisible();
    await expect(page.getByText(member.email)).toBeVisible();
    await expect(page.getByText("Morgan Lee invited you to join.")).toBeVisible();
    await page.getByRole("button", { name: `Accept and join ${organization.name}` }).click();
    await expect.poll(() => accepted).toBe(true);
    await expect(page).toHaveURL(new RegExp(`/o/${organization.slug}$`));
  });

  test("blocks accepting an organization invite from the wrong signed-in email", async ({ page }) => {
    await mockApp(page, true, "operator");
    await page.route("**/api/organization-invites/invite-other", (route) => json(route, { data: { organizationId: organization.id, organizationName: organization.name, organizationSlug: organization.slug, email: "captain@league.com", role: "referee", status: "pending", inviterName: "Morgan Lee" } }));
    await page.goto("/invite/invite-other");
    await expect(page.getByText("Switch to the invited account")).toBeVisible();
    await expect(page.getByRole("button", { name: `Accept and join ${organization.name}` })).toBeDisabled();
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

  test("keeps an existing organization owner in the operator workspace when profile role is stale", async ({ page }) => {
    await page.unrouteAll();
    await mockApp(page, true, "operator", "player");
    await page.goto(`/o/${organization.slug}`);
    await expect(page.getByRole("heading", { name: organization.name })).toBeVisible();
    await expect(page.getByText("Command center", { exact: true }).first()).toBeVisible();
  });

  test("keeps legacy access to multiple organizations and allows switching between them", async ({ page }) => {
    await page.unrouteAll();
    await mockApp(page, true, "operator", "operator", [organization, { ...organization, id: "org-2", name: "Regional League", slug: "regional-league" }]);
    await page.goto(`/o/${organization.slug}`);
    await expect(page.getByRole("heading", { name: organization.name })).toBeVisible();
    if (test.info().project.name.startsWith("mobile")) await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { name: organization.name }).click();
    await page.getByRole("menuitem", { name: "Regional League" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/regional-league$`));
    await expect(page.getByRole("heading", { name: "Regional League" })).toBeVisible();
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

test.describe("competition and event administration", () => {
  test.beforeEach(async ({ page }) => { await mockApp(page, true, "operator"); });

  test("edits a competition on its own settings page with image controls in settings", async ({ page }) => {
    await page.route("**/api/competitions/crud/Get", (route) => json(route, { data: {
      id: "competition-settings-1", organizationId: organization.id, name: "Continental Cup", description: "A long enough description explaining the annual continental club tournament.", category: "football", entryType: "team", visibility: "public", eligibility: {}, status: "draft", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    } }));
    await page.goto(`/o/${organization.slug}/competitions/competition-settings-1/settings`);
    await expect(page.getByRole("heading", { name: "Competition settings" })).toBeVisible();
    await expect(page.getByLabel("Competition name")).toHaveValue("Continental Cup");
    await expect(page.getByText("Competition image")).toBeVisible();
    await expect(page.getByRole("navigation").getByText("Competitions")).toBeVisible();
  });

  test("edits an event name and appearance on a dedicated settings page", async ({ page }) => {
    await page.route("**/api/competitions/crud/Get", (route) => json(route, { data: {
      id: "competition-settings-1", organizationId: organization.id, name: "Continental Cup", description: "A long enough description explaining the annual continental club tournament.", category: "football", entryType: "team", visibility: "public", eligibility: {}, status: "draft", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    } }));
    await page.route("**/api/events/crud/Get", (route) => json(route, { data: {
      id: "event-settings-1", competitionId: "competition-settings-1", name: "Open Division", format: "league", participantType: "team", registrationPolicy: "open", status: "draft", config: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    } }));
    await page.goto(`/o/${organization.slug}/competitions/competition-settings-1/events/event-settings-1/settings`);
    await expect(page.getByRole("heading", { name: "Event settings" })).toBeVisible();
    await expect(page.getByLabel("Event name")).toHaveValue("Open Division");
    await expect(page.getByText("Event image")).toBeVisible();
    await expect(page.getByText("Entry and capacity")).toBeVisible();
  });

  test("exposes scoring, publication, approval and esports game settings without touching fixture tables", async ({ page }) => {
    await page.route("**/api/competitions/crud/Get", (route) => json(route, { data: {
      id: "competition-esports-1", organizationId: organization.id, name: "Esports Open", description: "A tournament for registered esports teams and players.", category: "esports", entryType: "team", visibility: "public", eligibility: {}, status: "draft", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    } }));
    await page.route("**/api/events/crud/Get", (route) => json(route, { data: {
      id: "event-esports-1", competitionId: "competition-esports-1", name: "Valorant Open", format: "single_elimination", participantType: "team", registrationPolicy: "approval_required", status: "open", config: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    } }));
    await page.route("**/api/stages/crud/GetWhere", (route) => json(route, { data: [{ id: "stage-1", eventId: "event-esports-1", orderIndex: 0, name: "Knockout", type: "single_elimination", config: {} }] }));
    await page.goto(`/o/${organization.slug}/competitions/competition-esports-1/events/event-esports-1/settings`);
    await expect(page.getByLabel("Competition format")).toBeVisible();
    await expect(page.getByLabel("Competition format")).toBeDisabled();
    await expect(page.getByLabel("Score label")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Game (optional)" })).toBeVisible();
    await expect(page.getByLabel("External tournament ID")).toBeVisible();
    await expect(page.getByLabel("Public results")).toBeVisible();
    await expect(page.getByLabel("Require operator approval")).toBeVisible();
  });

  test("builds required home, invite and live pages and preserves the home links", async ({ page }) => {
    const competition = {
      id: "competition-pages-1", organizationId: organization.id, name: "Continental Cup", description: "A long enough description explaining the annual continental club tournament.", category: "football", entryType: "team", visibility: "public", eligibility: {}, status: "published", themeColor: "#2457B8", pages: [
        { id: "system-home", kind: "home", name: "Home", slug: "home", enabled: true, blocks: [{ id: "hero", type: "hero", title: "Welcome" }, { id: "stats", type: "statistics", title: "Competition progress" }, { id: "events", type: "event_list", title: "Programme" }] },
        { id: "system-invite", kind: "invite", name: "Invite", slug: "invite", enabled: true, blocks: [{ id: "join", type: "call_to_action", title: "Join", href: "/register" }] },
        { id: "system-live", kind: "live", name: "Live", slug: "live", enabled: true, blocks: [{ id: "live-link", type: "call_to_action", title: "Open live view" }] },
      ], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    };
    await page.route("**/api/competitions/crud/Get", (route) => json(route, { data: competition }));
    await page.route("**/api/organizations/crud/Get", (route) => json(route, { data: organization }));
    await page.goto(`/c/${competition.id}`);
    await expect(page.getByRole("navigation", { name: "Competition pages" }).getByRole("link")).toHaveCount(3);
    await page.getByRole("navigation", { name: "Competition pages" }).getByRole("link", { name: "Invite" }).click();
    await expect(page).toHaveURL(/page=invite/);
    await expect(page.getByRole("heading", { name: "Find your place in the field." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue to registration" })).toHaveAttribute("href", "/register");
  });

  test("offers required pages and editable sections in the competition page editor", async ({ page }) => {
    await page.route("**/api/competitions/crud/Get", (route) => json(route, { data: {
      id: "competition-pages-1", organizationId: organization.id, name: "Continental Cup", description: "A long enough description explaining the annual continental club tournament.", category: "football", entryType: "team", visibility: "public", eligibility: {}, status: "draft", pages: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    } }));
    await page.goto(`/o/${organization.slug}/competitions/competition-pages-1/pages`);
    await expect(page.getByRole("heading", { name: "Build competition pages" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Home/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Invite/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Live/ })).toBeVisible();
    await page.getByRole("button", { name: /Invite/ }).click();
    await page.getByRole("checkbox", { name: "Show Join link on Home and publish this page" }).check();
    await expect(page.getByText("Join is also linked from Home")).toBeVisible();
  });

  test("requires an exact organization name before the owner can delete the workspace", async ({ page }) => {
    let deleteRequest: Record<string, unknown> | undefined;
    await page.route("**/api/organizations/crud/Delete", async (route) => {
      deleteRequest = route.request().postDataJSON() as Record<string, unknown>;
      return json(route, { data: true });
    });
    await page.goto(`/o/${organization.slug}/settings`);
    await page.getByRole("button", { name: "Delete organization" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete organization" });
    await expect(dialog.getByRole("button", { name: "Delete organization" })).toBeDisabled();
    await dialog.getByLabel("Confirm organization name").fill(organization.name);
    await expect(dialog.getByRole("button", { name: "Delete organization" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Delete organization" }).click();
    await expect.poll(() => deleteRequest).toMatchObject({ id: organization.id });
  });

  test("does not show organization deletion to a regular organization member", async ({ page }) => {
    await page.route("**/api/org_members/crud/GetWhere", (route) => json(route, { data: [{ id: "member-role", organizationId: organization.id, memberId: member.id, role: "member", permissions: [], joinedAt: "2026-01-01T00:00:00.000Z" }] }));
    await page.goto(`/o/${organization.slug}/settings`);
    await expect(page.getByRole("heading", { name: "Identity and control." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete organization" })).toHaveCount(0);
  });
});
