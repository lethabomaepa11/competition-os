# CompetitionOS

CompetitionOS is a competition operations platform for leagues, federations, tournament organizers, teams, and players. It combines competition setup, event formats, registrations, fixtures, brackets, standings, live control, public coverage, roster management, and personal performance in one workspace.

## Product areas

- **Organizer command center** — manage organizations, competitions, members, reusable blueprints, audit history, and live operations under `/o/{organization}`.
- **Competition operations** — create competitions with a clear identity, configure events and formats, manage entrants, publish schedules, record scores, and advance brackets.
- **Team hub** — captains can create teams, rename them, add registered players by email, and maintain rosters under `/app/teams`.
- **Player workspace** — participants can see their active events, career record, scoring totals, and recent match history under `/app/performance`.
- **Public coverage** — share competition pages and live views without exposing the operator workspace.

Workspace links always use the active deployment host, for example `https://your-host.com/o/your-organization`.

## Architecture and data

The app is built with Next.js, React, Ant Design, and Supabase. Authentication, application data, row-level security, and storage are backed by Supabase. Domain services in `src/domain/services` keep UI code separate from persistence.

The redesign works with the existing production schema and does not require a destructive migration. Participant performance and team management read and write the current tables through authenticated server routes.

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

The Playwright suite covers the public story, authentication, participant performance, team roster controls, current-host organization links, and required competition descriptions on desktop and mobile Chromium.
