# Task 6: Add cover image to event page

## Status: DONE

## What was done
1. Added `import ImageUpload from "@/components/upload/image-upload"` at line 9 (after existing `EventService` import)
2. Replaced the event header area (lines 993-1015) with a new structure:
   - Cover image displayed above the title if `event.coverImage` is set
   - `ImageUpload` component placed next to the event title
   - Upload handler creates a new `EventService`, calls `svc.update(event.id, { coverImage: url }, currentMember.id)`, shows success message, and calls existing `refresh()`
   - Preserved format tag, status tag, and action buttons (Initialize & Start / Complete Event)

## Deviations from brief
- Added `currentMember.id` as third argument to `svc.update()` because `EventService.update()` requires 3 arguments (id, data, actorId)
- Added `if (!currentMember) return` guard because `currentMember` can be `null`
- Restructured the outer div to wrap cover image + title line + action buttons together while preserving existing layout

## Verification
- `npx tsc --noEmit`: only pre-existing errors in `route.ts` and `app-context.tsx` remain; no new errors

## Commits
- `848a9e3` feat: add cover image upload to event page
