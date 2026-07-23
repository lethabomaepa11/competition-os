# Live Page Hero Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the live page's plain text header with a hero banner using the active event's cover image, matching the invite page style.

**Architecture:** Single file change to `src/app/live/[orgSlug]/[competitionId]/page.tsx`. The header div (lines 436-474) is replaced with a hero section matching the invite page pattern. Event buttons move into the hero overlay. Refresh button moves above the tabs. TipTap content card added below hero.

**Tech Stack:** Next.js App Router, Ant Design, TypeScript, TipTap renderer

## Global Constraints

- Cover image source priority: active event > competition > dark gradient fallback
- Hero styling matches `src/app/invite/competition/[token]/page.tsx` lines 179-246
- Event buttons keep their current style: `<Button>` with `type={primary|default}`, `size="small"`
- Event buttons only shown when `events.length > 1`
- Overview tab content (stats, matches) stays unchanged
- All other tabs (AI Insights, Standings, Bracket, Betting) stay unchanged

---

### Task 1: Add imports and create hero section

**Files:**
- Modify: `src/app/live/[orgSlug]/[competitionId]/page.tsx`

**Interfaces:**
- Consumes: `competition` (Competition), `events` (Event[]), `activeEventId` (string | null), `activeEvent` (Event | undefined), `handleSelectEvent(eventId: string) => Promise<void>`, `refreshKey` (number), `setRefreshKey` (React.Dispatch<React.SetStateAction<number>>)
- Produces: Updated JSX with hero banner replacing lines 436-474

- [ ] **Step 1: Add TipTapRenderer import**

Add at line 16 (after the existing Ant Design imports, before the icon imports):

```tsx
import TipTapRenderer from "@/components/editor/tiptap-renderer";
```

- [ ] **Step 2: Replace the header section with the hero section**

Find lines 428-480 (the return block from `<div style={{maxWidth:1000...` to the closing `</div>` before the Tabs) and replace with:

```tsx
  return (
    <div>
      {/* Hero section */}
      <div style={{
        position: "relative",
        minHeight: activeEvent?.coverImage ? 420 : 280,
        display: "flex",
        alignItems: "flex-end",
        overflow: "hidden",
        background: activeEvent?.coverImage || competition?.coverImage
          ? "none"
          : "linear-gradient(135deg, #0A0B0F 0%, #13141A 50%, #0A0B0F 100%)",
      }}>
        {(activeEvent?.coverImage || competition?.coverImage) && (
          <>
            <img
              src={activeEvent?.coverImage ?? competition?.coverImage ?? ""}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.85) 100%)",
            }} />
          </>
        )}
        {!activeEvent?.coverImage && !competition?.coverImage && (
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(232,166,35,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
        )}

        <div style={{
          position: "relative",
          zIndex: 1,
          padding: activeEvent?.coverImage || competition?.coverImage ? "120px 24px 48px" : "64px 24px 40px",
          maxWidth: 1000,
          margin: "0 auto",
          width: "100%",
        }}>
          <Space style={{ marginBottom: 12 }}>
            <Tag color="gold" style={{ fontSize: 12, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}>
              {competition?.game?.name ?? "Competition"}
            </Tag>
            <Tag style={{ fontSize: 12, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}>
              {events.length} {events.length === 1 ? "Event" : "Events"}
            </Tag>
          </Space>
          <Title level={1} style={{ margin: 0, fontSize: 32, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
            {competition?.name}
          </Title>
          {competition?.description && (
            <Text style={{ display: "block", marginTop: 8, fontSize: 15, maxWidth: 600, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
              {competition.description}
            </Text>
          )}

          {/* Event buttons */}
          {events.length > 1 && (
            <div style={{ marginTop: 24 }}>
              <Space>
                {events.map((e) => (
                  <Button
                    key={e.id}
                    type={activeEventId === e.id ? "primary" : "default"}
                    size="small"
                    onClick={() => handleSelectEvent(e.id)}
                  >
                    {e.name}
                  </Button>
                ))}
              </Space>
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px" }}>
        {/* TipTap content card */}
        {competition?.content && (
          <Card style={{
            marginBottom: 24,
            marginTop: -24,
            position: "relative",
            zIndex: 2,
          }}>
            <TipTapRenderer content={competition.content} />
          </Card>
        )}

        {/* Refresh button + Tabs */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey((k) => k + 1)}>
            Refresh
          </Button>
        </div>

        {activeEvent && <Tabs items={tabItems} />}

        {events.length === 0 && <Empty description="No events found." />}
      </div>
    </div>
  );
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-Object -First 30`
Expected: no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/app/live/\[orgSlug\]/\[competitionId\]/page.tsx
git commit -m "feat: redesign live page with event cover image hero banner"
```
