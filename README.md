# CompetitionOS

CompetitionOS is a competition operations platform for leagues, federations, tournament organizers, teams, and players. It combines competition setup, event formats, registrations, fixtures, brackets, standings, live control, public coverage, roster management, and personal performance in one workspace.

## Product areas

- **Organizer command center** — operator onboarding provisions one organization, then the operator manages competitions, members, blueprints, audit history, registration approvals, and live operations under `/o/{organization}`.
- **Competition operations** — create competitions with a clear identity, configure events and formats, manage entrants, publish schedules, record scores, and advance brackets.
- **Team hub** — team onboarding provisions the named club or organization; captains update its identity, invite players by email or share link, maintain the roster, and apply to eligible tournaments.
- **Player workspace** — player accounts can apply to individual tournaments and see active events, career records, scoring totals, and recent match history.
- **How to center** — `/how-to` provides role based walkthroughs with product screenshots for setup, registrations, formats, scoring, brackets, rosters, publishing, and access control.
- **Public coverage** — share competition pages and live views without exposing the operator workspace.

Workspace links always use the active deployment host, for example `https://your-host.com/o/your-organization`.

## Architecture and data

The app is built with Next.js, React, Ant Design, and Supabase. Authentication, application data, row-level security, and storage are backed by Supabase. Domain services in `src/domain/services` keep UI code separate from persistence.

The redesign uses an additive migration for account roles, team identity, registration approvals, and invite links. Existing organization members are backfilled as operators, existing captains as team accounts, and remaining accounts as players.

The PWA caches public product guidance and static assets. Authenticated workspaces, APIs, live scores, and private competition data always use the network and fall back to a dedicated offline screen instead of stale cached data.

## Local development

Install dependencies and start the app:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create `.env.local` with the Supabase project values:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

For a local Supabase stack:

```bash
supabase start
supabase db reset
```

Local Supabase Studio is available at [http://127.0.0.1:54323](http://127.0.0.1:54323).

## Transactional mail

Mail is sent through Brevo from `src/app/api/mail/route.ts`.

```bash
BREVO_API_KEY=your-brevo-api-key
BREVO_FROM_EMAIL=verified-sender@example.com
BREVO_FROM_NAME=CompetitionOS
```

## Verification

```bash
npm run build
npm run lint
npm run test:e2e
```

The Playwright suite covers the public story, role specific onboarding, the illustrated how to center, participant performance, team roster controls, required competition descriptions, and deterministic bracket progression on desktop and mobile Chromium.
