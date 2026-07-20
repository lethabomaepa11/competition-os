### Task 2: Update domain types

**Files:**
- Modify: `src/domain/competition.ts` — add `coverImage` and `content`
- Modify: `src/domain/event.ts` — add `coverImage`

- [ ] **Step 1: Add fields to Competition**

```typescript
// src/domain/competition.ts
export interface Competition extends Timestamps {
  // ... existing fields ...
  coverImage?: string;
  content?: Record<string, unknown>;  // TipTap JSON
}
```

- [ ] **Step 2: Add coverImage to Event**

```typescript
// src/domain/event.ts
export interface Event extends Timestamps {
  // ... existing fields ...
  coverImage?: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domain/competition.ts src/domain/event.ts
git commit -m "feat: add coverImage and content to domain types"
```
