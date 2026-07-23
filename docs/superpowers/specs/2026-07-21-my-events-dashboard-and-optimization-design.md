# My Events Dashboard Page & System Optimization

## Part 1: My Events Page

### Overview

Add a `/app/events` page where authenticated users see all events they've registered for as participants. Clicking an event navigates to its competition's live view (`/live/{orgSlug}/{competitionId}`).

### Route

- **`src/app/app/events/page.tsx`** — new page, client component
- Uses existing `AppProvider` / `useApp` context (already wraps `/app` pages)
- Consistent layout with the dashboard (same Header, same padding/max-width)

### Navigation

- Add a "My Events" link in the dashboard header (next to the avatar, before the logout button)
- The link is just an anchor/button, not a tab

### Data Flow

Single `fetch("/api/me/events")` call. Server-side:

1. Get current member ID from session
2. `query("participants", p => p.memberId === memberId && p.status === "active")`
3. Extract unique `eventId`s → `Promise.all(eventIds.map(id => evtSvc.get(id)))`
4. Extract unique `competitionId`s → `Promise.all(compIds.map(id => compSvc.get(id)))`
5. Extract unique `organizationId`s → `Promise.all(orgIds.map(id => orgSvc.get(id)))`
6. Join and return JSON

Client just renders the response.

### UI

- Loading: `<Spin>` centered
- Empty state: `<Empty>` with message "You haven't joined any events yet" and a button linking to the dashboard to browse competitions
- Card grid (Row/Col, xs=24 sm=12): each card shows:
  - Event name (title)
  - Event status (`<Tag>` with color)
  - Competition name
  - Organization name
  - Hoverable, onClick → `router.push(/live/${org.slug}/${competition.id})`

### Edge Cases

- Member has no participants → Empty state
- Event/competition/org deleted after registration → show "Unknown" fallback text, skip rendering that card
- Member registered for multiple events in the same competition → show each event separately

---

## Part 2: System Optimization

### Problem

All 13 domain services query Supabase directly from the client via the repository layer (`src/lib/store.ts` → `src/lib/supabase/repository.ts`). Pages like the event detail page make 10+ sequential client-side calls. This saturates the device with processing and exposes the data layer.

### Architecture Change

Move all data access from client-side services to Next.js API routes. Each page/view calls one (or very few) API endpoints. The server joins data and returns it as a single response.

### Phase 1: New API Endpoints (this implementation)

| Endpoint | Purpose |
|---|---|
| `GET /api/me/events` | Events the current member joined, with competition + org data |
| `GET /api/me/organizations` | Organizations the member belongs to |

### Phase 2: Service-to-API Migration (future)

Migrate each domain service method to an API route:

| Service | Key Methods | API Route |
|---|---|---|
| `CompetitionService.get` | `get(id)` | `GET /api/competitions/[id]` |
| `EventService.get / .list` | `get(id)`, `list(compId)` | `GET /api/events/[id]`, `GET /api/competitions/[id]/events` |
| `EventService.getStages / .getRounds` | `getStages(eventId)`, `getRounds(stageId)` | `GET /api/events/[id]/stages` |
| `RegistrationService.getParticipants` | `getParticipants(eventId)` | `GET /api/events/[id]/participants` |
| `MatchService.list` | `list(eventId)` | `GET /api/events/[id]/matches` |
| `StandingsService.calculate` | `calculate(eventId, stageId)` | `GET /api/events/[id]/standings?stageId=x` |
| `OrganizationService.get` | `get(id)` | `GET /api/organizations/[id]` |

### Client Changes

- Pages become thin: one `fetch()` call → render
- Remove direct imports of domain services from page components
- Domain services and repository layer stay server-side (or are replaced by API route handlers)
- Data joining happens in the API route, not the browser

### Implementation Order

1. Create `/api/me/events` endpoint
2. Rewrite `/app/events` page to call it
3. Create navigation link in dashboard header
4. Create `/api/me/organizations` endpoint
5. Rewrite `/app` dashboard page to call it
6. Remaining pages await separate planning
