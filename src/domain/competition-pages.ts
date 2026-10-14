export type CompetitionPageKind = "home" | "invite" | "live" | "custom";

export type CompetitionBlockType =
  | "hero"
  | "rich_text"
  | "event_list"
  | "schedule"
  | "roster"
  | "standings"
  | "bracket"
  | "results"
  | "statistics"
  | "sponsors"
  | "call_to_action";

export interface CompetitionPageBlock {
  id: string;
  type: CompetitionBlockType;
  title?: string;
  body?: string;
  href?: string;
}

export interface CompetitionPage {
  id: string;
  kind: CompetitionPageKind;
  name: string;
  slug: string;
  enabled: boolean;
  blocks: CompetitionPageBlock[];
}

const requiredPages: CompetitionPage[] = [
  { id: "system-home", kind: "home", name: "Home", slug: "home", enabled: true, blocks: [{ id: "home-hero", type: "hero", title: "Welcome" }, { id: "home-stats", type: "statistics", title: "Competition progress" }, { id: "home-events", type: "event_list", title: "Competition programme" }] },
  { id: "system-invite", kind: "invite", name: "Invite", slug: "invite", enabled: false, blocks: [{ id: "invite-join", type: "call_to_action", title: "Find your place in the field.", body: "Choose the event that fits your team or player profile, then complete your registration.", href: "/app/opportunities" }] },
  { id: "system-live", kind: "live", name: "Live", slug: "live", enabled: true, blocks: [{ id: "live-overview", type: "statistics", title: "Live competition centre" }, { id: "live-link", type: "call_to_action", title: "Open live view" }] },
];

export function ensureRequiredCompetitionPages(pages: CompetitionPage[] = []): CompetitionPage[] {
  const saved = new Map(pages.map((page) => [page.kind, page]));
  const systems = requiredPages.map((systemPage) => ({ ...systemPage, ...(saved.get(systemPage.kind) ?? {}), kind: systemPage.kind }));
  return [...systems, ...pages.filter((page) => page.kind === "custom")];
}

export function createCustomCompetitionPage(index: number): CompetitionPage {
  return {
    id: `custom-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`,
    kind: "custom",
    name: `Page ${index}`,
    slug: `page-${index}`,
    enabled: true,
    blocks: [{ id: `custom-${Date.now().toString(36)}-content`, type: "rich_text", title: "New section", body: "Add information for your audience." }],
  };
}
