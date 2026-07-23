# Live Scoring, Realtime Updates & AI Commentary

## Overview

Add live match scoring with Supabase Realtime, a promoted live match card on the spectator page, count-up timer, and AI-generated play-by-play commentary — while making the whole page mobile responsive and sporty.

## Architecture

### Data Flow

```
Admin (+/- in modal) → MatchService.updateScores() → CRUD API → Supabase update → Realtime broadcast
                                                                                         ↓
Live page ←←← Realtime subscription ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
  → update match state → promoted card re-renders → timer ticks
  → trigger AI commentary API → store in match_comments → comment appears in feed
```

### Database Changes

1. Enable Realtime on `matches` table: `alter publication supabase_realtime add table matches;`
2. New `match_comments` table: id, match_id, text, created_at

### MatchService

Add `updateScores(matchId, scores)` that writes `scores` JSONB directly to the match row (separate from final result). Realtime broadcasts the change to all subscribers.

### Admin Scoring Modal

The existing `match-list.tsx` scoring buttons already call `startMatch()` then provide +/- for scores. Change the +/- handlers to also call `updateScores()` (not just the audit trail), so scores update live on the match object.

### Live Page (Spectator)

1. **Realtime subscription**: On mount, subscribe to `matches` table changes. When a match updates (scores change, status changes), merge into local state.
2. **Promoted live match**: Any match with `status === "in_progress"` gets a hero scoreboard card at the top showing: participant names, scores, pulsing "LIVE" badge, count-up timer.
3. **Match detail modal**: Click the promoted card → modal with full scoreboard, commentary feed.
4. **Refresh button**: Keep but also rely on Realtime for instant updates.

### AI Commentary

1. **API endpoint**: `POST /api/ai/commentary` — takes matchId, scores array, match info. Returns commentary text.
2. **Trigger**: When scores change via Realtime, client calls API (debounced ~8s per match to avoid spam).
3. **Storage**: Commentary stored in `match_comments` table via the same API endpoint.
4. **Display**: In the match detail modal as a scrollable feed, newest at bottom.

### Mobile Responsive

- Stat cards: `xs={12} sm={12} md={6}` (2 across on mobile, 4 on desktop)
- Live match card: stacks vertically on mobile
- Match detail modal: full-screen on mobile
- Hero padding reduced on mobile
- Tables with horizontal scroll

### Sporty Styling

- Scoreboard layout: participant names on left/right, score bold in center
- Gold accent for winner/live elements
- Pulsing dot for live status
- Trophy icon for completed match winners
- Count-up timer with stopwatch feel

## Files to Change

| File | Change |
|------|--------|
| `supabase/migrations/20260721000001_realtime_match_comments.sql` | Create |
| `src/domain/services/match.service.ts` | Add `updateScores()` |
| `src/components/match/match-list.tsx` | Wire ± to `updateScores()` |
| `src/app/live/[orgSlug]/[competitionId]/page.tsx` | Realtime, promoted card, timer, modal, responsive, sporty |
| `src/app/api/ai/commentary/route.ts` | Create |
| `src/components/live/live-match-card.tsx` | Create (scoreboard card) |
| `src/components/live/match-detail-modal.tsx` | Create (modal with commentary) |
| `src/components/live/commentary-feed.tsx` | Create (commentary list) |
| `src/components/live/live-timer.tsx` | Create (count-up timer) |
