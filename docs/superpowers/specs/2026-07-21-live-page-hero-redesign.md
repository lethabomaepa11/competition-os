# Live Page Hero Redesign

## Overview

Replace the live page's plain text header with a hero banner matching the invite page style. The hero uses the **active event's cover image** as background and switches when the user clicks a different event/game button.

## Architecture

- **Single file change:** `src/app/live/[orgSlug]/[competitionId]/page.tsx`
- No new components, no new dependencies
- Reuses the same hero pattern from `src/app/invite/competition/[token]/page.tsx` (lines 179-246)

## Hero Section

### Background

| Priority | Source |
|----------|--------|
| 1 | `activeEvent.coverImage` — full-bleed background image |
| 2 | `competition.coverImage` — fallback if event has no cover |
| 3 | Dark gradient `linear-gradient(135deg, #0A0B0F 0%, #13141A 50%, #0A0B0F 100%)` |

Gradient overlay over image: `linear-gradient(rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.85) 100%)`

When no cover image at all: add the radial glow decoration (`radial-gradient(circle, rgba(232,166,35,0.06) 0%, transparent 70%)`)

### Content Inside Hero

All text uses `color: #fff` with `textShadow: "0 2px 12px rgba(0,0,0,0.7)"`:

1. **Tags row** (top):
   - Game name tag (`color="gold"`)
   - Events count tag ("N Events" or "N Event")

2. **Title** — competition name (`Title level={1}`, fontSize 28-32)

3. **Description** — competition description if present (optional, same as invite page)

4. **Event buttons** — placed at bottom of hero area:
   - Same style as current: `<Button>` with `type={activeEventId === e.id ? "primary" : "default"}`, `size="small"`
   - Wrapped in a `<Space>` 
   - Only shown when `events.length > 1`

5. **Refresh button** — moved from the header to just above the tabs component (line 476), right-aligned in a flex row with the tab label area

### Height

- With cover image: `minHeight: 420px`, padding `120px 24px 48px` (same as invite)
- Without cover: `minHeight: 280px`, padding `64px 24px 40px` (same as invite)

## Cover Image Switching

When `handleSelectEvent` is called:
- Hero background transitions to the new event's `coverImage` (or falls back)
- Event data loads below (existing behavior)

## Layout Below Hero

1. **Competition TipTap content card** (if `competition.content` exists) — overlapping the hero, same card style as invite page (`marginTop: -24`, `zIndex: 2`, `position: relative`)
2. **Tabs** — unchanged: Overview, AI Insights, Standings, Bracket, Betting
3. The `<Tabs>` component currently at line 476 continues to render the same `tabItems`

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No events | Show hero with competition info only, no event buttons, show `<Empty>` below |
| Event has no cover | Fall back to competition cover, then dark gradient |
| Single event (1) | Show hero, hide event buttons (no switching needed) |
| Loading state | Hero shows with dark gradient fallback, `<Spin>` below |
| Error state | Unchanged — `<Alert>` replaces everything |

## What Stays the Same

- Overview tab content (stat cards, live matches, recent results)
- All other tabs (AI Insights, Standings, Bracket, Betting)
- Data fetching logic, event switching, refresh button
- The `<StatisticLike>` component at bottom of file
- The `<AppProvider>` wrapper

## Implementation

1. Replace the current header div (lines 436-474) with the hero section
2. Move the event buttons into the hero overlay
3. Add image/gradient background logic matching the invite page pattern
4. Keep the TipTap content card + tabs below unchanged