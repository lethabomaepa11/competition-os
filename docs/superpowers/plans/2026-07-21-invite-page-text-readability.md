# Invite Page Hero Text Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure text overlaid on competition invite page cover images remains readable regardless of image brightness.

**Architecture:** Single file change — modify the gradient overlay and add text-shadow to hero text elements in the competition invite page. No new components or dependencies.

**Tech Stack:** Next.js, Ant Design, TypeScript, inline CSS

**Global Constraints:**
- No new dependencies
- No new components
- Must work with any image (dark or light)

---

### Task 1: Update hero gradient and text in competition invite page

**Files:**
- Modify: `src/app/invite/competition/[token]/page.tsx:179-246`

**Interfaces:**
- Consumes: existing `competition.coverImage` display logic
- Produces: visually readable hero text on any image background

- [ ] **Step 1: Replace the gradient overlay**

Change line 203 from:
```tsx
background: "linear-gradient(transparent 40%, rgba(10,11,15,0.95))",
```
to:
```tsx
background: "linear-gradient(rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.85) 100%)",
```

- [ ] **Step 2: Add color and text-shadow to the Title**

Change line 232 from:
```tsx
<Title level={1} style={{ margin: 0, fontSize: 32 }}>
```
to:
```tsx
<Title level={1} style={{ margin: 0, fontSize: 32, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
```

- [ ] **Step 3: Add text-shadow to the game name text**

Change lines 235-238 from:
```tsx
{competition?.game && (
  <Text style={{ fontSize: 14, display: "block", marginTop: 4 }}>
    {competition.game.name}
  </Text>
)}
```
to:
```tsx
{competition?.game && (
  <Text style={{ fontSize: 14, display: "block", marginTop: 4, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
    {competition.game.name}
  </Text>
)}
```

- [ ] **Step 4: Add text-shadow to the description text**

Change lines 240-244 from:
```tsx
{competition?.description && (
  <Text style={{ display: "block", marginTop: 8, fontSize: 15, maxWidth: 600 }}>
    {competition.description}
  </Text>
)}
```
to:
```tsx
{competition?.description && (
  <Text style={{ display: "block", marginTop: 8, fontSize: 15, maxWidth: 600, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
    {competition.description}
  </Text>
)}
```

- [ ] **Step 5: Add text-shadow to inline Tag text**

Change line 229 from:
```tsx
<Tag color="gold" style={{ fontSize: 12 }}>{competition?.game?.name ?? "Competition"}</Tag>
<Tag style={{ fontSize: 12 }}>{events.length} {events.length === 1 ? "Event" : "Events"}</Tag>
```
to:
```tsx
<Tag color="gold" style={{ fontSize: 12, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}>{competition?.game?.name ?? "Competition"}</Tag>
<Tag style={{ fontSize: 12, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}>{events.length} {events.length === 1 ? "Event" : "Events"}</Tag>
```

- [ ] **Step 6: Verify the build**

Run: `npm run build` or `npx next build` and confirm no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/invite/competition/\[token\]/page.tsx
git commit -m "fix: ensure hero text readable over any cover image"
```
