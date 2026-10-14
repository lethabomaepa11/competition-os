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

export interface CompetitionPagesValidation {
  pages?: CompetitionPage[];
  errors: string[];
}

const pageKinds = new Set<CompetitionPageKind>(["home", "invite", "live", "custom"]);
const blockTypes = new Set<CompetitionBlockType>([
  "hero", "rich_text", "event_list", "schedule", "roster", "standings", "bracket",
  "results", "statistics", "sponsors", "call_to_action",
]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Validates the complete page graph before it reaches the competition record. */
export function validateCompetitionPages(input: unknown): CompetitionPagesValidation {
  if (!Array.isArray(input) || input.length < 3 || input.length > 24) {
    return { errors: ["A competition needs its required pages and can have at most 24 pages."] };
  }

  const errors: string[] = [];
  const pages: CompetitionPage[] = [];
  for (const [pageIndex, value] of input.entries()) {
    if (!value || typeof value !== "object") {
      errors.push(`Page ${pageIndex + 1} is invalid.`);
      continue;
    }
    const raw = value as Record<string, unknown>;
    const kind = raw.kind as CompetitionPageKind;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const slug = typeof raw.slug === "string" ? raw.slug.trim().toLowerCase() : "";
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!id || id.length > 100 || !pageKinds.has(kind)) errors.push(`Page ${pageIndex + 1} has an invalid identity.`);
    if (!name || name.length > 48) errors.push(`Page ${pageIndex + 1} needs a name of 48 characters or fewer.`);
    if (!slugPattern.test(slug) || slug.length > 48) errors.push(`${name || `Page ${pageIndex + 1}`} has an invalid page link.`);
    if (!Array.isArray(raw.blocks) || raw.blocks.length > 30) {
      errors.push(`${name || `Page ${pageIndex + 1}`} can have at most 30 sections.`);
      continue;
    }
    const blocks = raw.blocks.flatMap((value, blockIndex) => {
      if (!value || typeof value !== "object") {
        errors.push(`Section ${blockIndex + 1} on ${name || `page ${pageIndex + 1}`} is invalid.`);
        return [];
      }
      const block = value as Record<string, unknown>;
      const type = block.type as CompetitionBlockType;
      const blockId = typeof block.id === "string" ? block.id.trim() : "";
      if (!blockId || blockId.length > 100 || !blockTypes.has(type)) {
        errors.push(`Section ${blockIndex + 1} on ${name || `page ${pageIndex + 1}`} has an invalid type or identity.`);
        return [];
      }
      const title = typeof block.title === "string" ? block.title.trim().slice(0, 100) : undefined;
      const body = typeof block.body === "string" ? block.body.trim().slice(0, 2_000) : undefined;
      const href = typeof block.href === "string" ? block.href.trim().slice(0, 500) : undefined;
      return [{ id: blockId, type, ...(title ? { title } : {}), ...(body ? { body } : {}), ...(href ? { href } : {}) }];
    });
    pages.push({ id, kind, name, slug, enabled: raw.enabled === true, blocks });
  }

  for (const kind of ["home", "invite", "live"] as const) {
    const matching = pages.filter((page) => page.kind === kind);
    if (matching.length !== 1) errors.push(`Exactly one ${kind} page is required.`);
    if ((kind === "home" || kind === "live") && matching[0]?.enabled !== true) errors.push(`The ${kind} page must remain published.`);
  }
  if (pages.some((page) => page.kind !== "custom" && !["home", "invite", "live"].includes(page.kind))) errors.push("Only custom pages can use a custom page type.");
  if (new Set(pages.map((page) => page.slug)).size !== pages.length) errors.push("Every page link must be unique.");
  if (new Set(pages.map((page) => page.id)).size !== pages.length) errors.push("Every page needs a unique identity.");

  const enabledSlugs = new Set(pages.filter((page) => page.enabled).map((page) => page.slug));
  for (const page of pages) {
    for (const block of page.blocks.filter((item) => item.type === "call_to_action" && item.href)) {
      const href = block.href!;
      if (href.startsWith("page:")) {
        if (!enabledSlugs.has(href.slice(5)) || href.slice(5) === page.slug) errors.push(`A link on ${page.name} points to a missing, unpublished, or circular page.`);
      } else if (!(/^https:\/\//i.test(href) || (href.startsWith("/") && !href.startsWith("//")))) {
        errors.push(`A link on ${page.name} must use https:// or a local path.`);
      }
    }
  }
  const invitePage = pages.find((page) => page.kind === "invite");
  if (invitePage?.enabled && !invitePage.blocks.some((block) => block.type === "call_to_action" && Boolean(block.href))) {
    errors.push("The published Invite page needs a working registration link.");
  }
  return errors.length ? { errors: [...new Set(errors)] } : { pages, errors: [] };
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
