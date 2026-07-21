# Invite Page Hero Text Readability

## Problem

The competition invite page (`/invite/competition/[token]`) shows competition name, game tag, and description overlaid on a cover image. The current gradient overlay goes `transparent 40% → rgba(10,11,15,0.95)`, meaning text in the top portion has no dark backing. If a dark image is uploaded, the text becomes unreadable.

## Solution

Replace the gradient and add text shadows — minimal changes, universal readability.

### Gradient change

Current:
```
"linear-gradient(transparent 40%, rgba(10,11,15,0.95))"
```

New:
```
"linear-gradient(rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.85) 100%)"
```

The new gradient is lighter overall (0.95 → 0.85 at bottom, transparent → 0.25 at top), so more of the image shows through while ensuring all text has some dark backing.

### Text changes

All hero text elements (title, game name, description, tag labels) get:
- `color: "#fff"`
- `textShadow: "0 2px 12px rgba(0,0,0,0.7)"`

The text-shadow acts as a per-character scrim that works on any background — dark or light images — without needing per-image luminance detection.

## Files Changed

- `src/app/invite/competition/[token]/page.tsx` — ~8 line changes

## Not in Scope

- Other invite pages (organization, participant) — they don't use cover images
- Adaptive luminance detection — unnecessary complexity for this use case
- New components or dependencies
