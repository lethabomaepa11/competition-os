# CompetitionOS production redesign

## Product direction

CompetitionOS becomes a competition command center for professional leagues, tournament operators, federations, and esports organizers. The interface should feel credible in a stadium control room and remain calm enough for day to day administration.

The visual system uses a deep navy canvas, warm white work surfaces, signal green for live state, and amber for attention. Typography is compact and editorial. Data is presented with strong hierarchy, clear operational status, and generous mobile layouts.

## Safety boundary

- Preserve all Supabase schemas, migrations, API routes, services, entity keys, and URL structures.
- Do not seed, migrate, delete, or modify production data during redesign or browser testing.
- Browser tests use mocked HTTP responses for authenticated and data dependent routes.
- Keep destructive and state changing actions behind their existing explicit controls.

## Information architecture

### Public

- Marketing home: product position, operator workflow, format coverage, enterprise readiness.
- Public competition and live views: broadcast header, live state, fixtures, tables, brackets, and statistics.
- Invitations and authentication: a consistent, focused access experience.

### Member workspace

- Organizations: the operator's portfolio and entry point.
- My events: the participant's active competition schedule.
- Profile and account recovery: shared access layout and form language.

### Organization command center

- Overview: competition and member totals, active operations, and primary actions.
- Competitions: scannable lifecycle view with status and dates.
- Members: roster, roles, and invitations.
- Blueprints: reusable competition operating models.
- Audit log: governance and undo history.
- Settings: organization identity.

## Delivery plan

1. Establish shared tokens, responsive primitives, motion, Ant Design overrides, brand mark, metadata, and accessibility defaults.
2. Rebuild the marketing home and account surfaces around the new product position.
3. Rebuild member and organization shells with responsive navigation and clearer context.
4. Redesign portfolio, overview, competitions, members, blueprints, audit, and settings pages.
5. Apply the design system to existing competition, event, live, invite, table, bracket, match, and statistics surfaces without changing their domain behavior.
6. Add Playwright coverage for public, account, member, and organization flows using network fixtures.
7. Run lint, production build, Playwright at desktop and mobile sizes, inspect screenshots, and correct regressions.
8. Create focused commits, push the feature branch, open a pull request, and run the local applications for review.

## Acceptance criteria

- Core pages are coherent at 1440 px, 1024 px, and 390 px widths.
- Keyboard focus is visible; controls retain accessible labels; motion respects reduced motion.
- Empty, loading, error, draft, live, completed, and archived states remain distinguishable.
- Existing domain services and persistence contracts are unchanged.
- Production build and Playwright suites pass.
- No browser test can reach production Supabase or mail endpoints.
