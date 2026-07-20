# Competition Invite Page Enhancement

## Goal

Enhance the competition invite page (`/invite/competition/[token]`) to show a polished public-facing page with a cover image and rendered rich-text content. Back this with the necessary schema changes and TipTap rendering infrastructure.

## Schema Changes

### New migration (`20260720000012_competition_content.sql`)

**Competitions table — add columns:**
- `cover_image text` — Supabase Storage URL for the cover/banner image
- `content jsonb` — TipTap editor JSON output (rich-text body)

**Events table — add column:**
- `cover_image text` — Supabase Storage URL for the event cover/banner image

**Storage bucket:**
- Create public bucket `competition-covers`
- Allowed MIME types: `image/png`, `image/jpeg`, `image/webp`
- Max file size: 10MiB

### Domain types

```typescript
// competition.ts — add:
coverImage?: string;
content?: Record<string, unknown>;  // TipTap JSON

// event.ts — add:
coverImage?: string;
```

## TipTap Rendering

- Add dependencies: `@tiptap/html` (JSON→HTML converter, ~30KB), `dompurify` (HTML sanitization)
- TipTap JSON is stored as-is in the `content` column
- On the invite page, convert JSON to HTML via `generateHTML()` and render with sanitization
- No TipTap editor in this scope — just rendering

## Invite Page Redesign

The page at `/invite/competition/[token]` gets a visual refresh:

1. **Hero section** — full-width cover image (if set) with gradient overlay, competition name overlaid
2. **Info bar** — game, date range, status
3. **Content section** — rendered TipTap body (if set), falls back to plain description
4. **Events list** — existing card grid, unchanged behavior

The existing auth flow (register/login → join events) stays untouched.

## Image Upload

A small upload component added to the competition edit form in the admin page:
- File picker accepting images only
- Uploads to Supabase Storage bucket `competition-covers`
- Stores returned public URL in `competition.coverImage`
- Same pattern for events when editing

## Implementation Plan

1. Create migration and run it
2. Update `Competition` and `Event` domain types
3. Install `@tiptap/html` and `dompurify`
4. Build TipTap renderer component (`<TipTapRenderer content={json} />`)
5. Build image upload component (`<ImageUpload bucket="competition-covers" ... />`)
6. Add cover image upload to competition edit form (admin page)
7. Add cover image upload to event edit form (admin page)
8. Redesign invite page with cover image + content rendering

## Not in Scope

- TipTap editor for authoring content (only rendering)
- Event content/body field (may add later)
- Public `/c/[competitionId]` page update (can reuse components later)
- RLS on storage bucket (remains open for now, as with other auth_* policies)
