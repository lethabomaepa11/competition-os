# CompetitionOS

CompetitionOS is a Next.js competition manager for organizations, competitions, events, brackets, standings, invites, audit logs, and live views.

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The app is currently local-first: user, organization, and competition data are stored in browser localStorage through `src/lib/store.ts`. This keeps product work fast while the Supabase schema and migrations are prepared.

## Supabase Local First

Supabase scaffolding lives in `supabase/` with the initial schema in `supabase/migrations/20260720000001_initial_schema.sql`.

Start the local Supabase stack:

```bash
supabase start
supabase db reset
```

Local services:

- API: http://127.0.0.1:54321
- Studio: http://127.0.0.1:54323

Add the local public URL and anon key to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

The Settings page shows whether those variables are present. The next persistence step is to migrate one repository at a time from localStorage to Supabase while keeping the current domain services stable.

## Mail

Transactional mail is sent through Brevo from `src/app/api/mail/route.ts`. Keep the API key server-side only.

Required env:

```bash
BREVO_API_KEY=your-brevo-api-key
BREVO_FROM_EMAIL=verified-sender@example.com
BREVO_FROM_NAME=CompetitionOS
```

Current mail events cover organization invites, participant invites, registration confirmations, competition status changes, event start/completion, bracket generation, standings updates, match scheduling, match starts, match results, and match disputes.

## Scripts

```bash
npm run dev
npm run build
npm run lint
```
