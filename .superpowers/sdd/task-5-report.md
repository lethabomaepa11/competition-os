# Task 5 Report: Add cover image + content to competition edit form

## Steps

1. **Add import** — Added `import ImageUpload from "@/components/upload/image-upload";` at the top of the file.
2. **Update edit modal form** — Replaced the form in the Edit Competition modal to include:
   - Cover Image field using `ImageUpload` component with `currentUrl` and `onUpload`
   - Content (TipTap JSON) field using `Input.TextArea` with nested `name={["content"]}`
   - Preserved existing Name, Description, Visibility, and Save button fields
3. **Update handleEditCompetition** — Extended the function signature to accept `coverImage?: string` and `content?: Record<string, unknown>`, and pass both to `svc.update()`.
4. **TypeScript verification** — `npx tsc --noEmit` completed. All 5 errors are pre-existing (none in the modified file).
5. **Commit** — `git commit -m "feat: add cover image and content fields to competition edit form"`

## Commit

- `600ef52` — feat: add cover image and content fields to competition edit form

## tsc Summary

No new errors introduced. All 5 pre-existing errors are in unrelated files (`route.ts`, `app-context.tsx`).

## Concerns

None.
