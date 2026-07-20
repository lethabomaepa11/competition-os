# Task 1 Report — Migration: Add columns + storage bucket

## What I implemented

Created migration `20260720000013_competition_content.sql` (note: used `00013` instead of the brief's `00012` because `00012` was already taken by `make_audit_org_id_nullable`):

- Added `cover_image` (text) and `content` (jsonb) columns to `competitions` table
- Added `cover_image` (text) column to `events` table
- Created `competition-covers` storage bucket (public, 10MB limit, png/jpeg/webp only)

## Test results

All three schema changes verified via `supabase db query`:

| Object | Column/Bucket | Type | Status |
|--------|--------------|------|--------|
| `competitions` | `cover_image` | `text` | created |
| `competitions` | `content` | `jsonb` | created |
| `events` | `cover_image` | `text` | created |
| `storage.buckets` | `competition-covers` | bucket, public | created |

Migration output: "Applying migration 20260720000013_competition_content.sql... Local database is up to date."

## Files changed

- `competitionos/supabase/migrations/20260720000013_competition_content.sql` (created)

## Issues / concerns

- **Timestamp collision avoided**: The brief specified `20260720000012` but that was already used by `make_audit_org_id_nullable.sql` (already applied). Used `20260720000013` instead.
- The git repo root is at `ai-tries/`, so the migration path in git is `competitionos/supabase/migrations/...`.

## Commit

```
4ef7574 feat: add cover_image and content columns, storage bucket
```
