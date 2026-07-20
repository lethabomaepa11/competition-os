# Task 2: Update domain types — Report

## Summary
Added `coverImage` and `content` fields to the `Competition` interface and `coverImage` to the `Event` interface as specified.

## Changes
- **`src/domain/competition.ts`**: Added `coverImage?: string` and `content?: Record<string, unknown>` to the `Competition` interface (after `logoUrl`).
- **`src/domain/event.ts`**: Added `coverImage?: string` to the `Event` interface (after `dateEnd`).

## Commit
- `832b461` — feat: add coverImage and content to domain types

## Verification
Both files compile cleanly. No tests exist for these domain types — the changes are purely additive optional fields with no behavioral impact.
