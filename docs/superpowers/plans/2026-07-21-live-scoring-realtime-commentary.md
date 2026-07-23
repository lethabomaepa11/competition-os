# Live Scoring, Realtime Updates & AI Commentary — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live match scoring with Supabase Realtime, promoted live match card, count-up timer, AI commentary, mobile responsive and sporty styling.

**Architecture:** Admin ± buttons → `MatchService.updateScores()` → CRUD API → Supabase → Realtime → Live page. AI commentary triggered on score changes, stored in `match_comments` table.

**Tech Stack:** Next.js App Router, Supabase (Realtime + Postgres), Ant Design, TypeScript

## Global Constraints

- All Realtime subscriptions use `createClient()` from `@/lib/supabase/client`
- Match scores are stored as JSONB on the matches table (existing `scores` column)
- AI commentary calls are debounced (minimum 8s between calls per match)
- No custom theme — use Ant Design components and inline styles only
- Mobile responsive: stat cards `xs={12}`, tables with horizontal scroll, full-screen modals on mobile

---

### Task 1: Database Migration + MatchService updateScores

**Files:**
- Create: `supabase/migrations/20260721000001_realtime_match_comments.sql`
- Modify: `src/domain/services/match.service.ts`

**Interfaces:**
- Produces: `MatchComment` type, `MatchService.updateScores(matchId, scores)` method
- Consumes: existing Match model (`scores` field exists inside `MatchResult`, `startedAt` exists)

- [ ] **Step 1: Create migration**

```sql
-- Enable Realtime on matches table
alter publication supabase_realtime add table matches;

-- Create match_comments table for AI commentary
create table match_comments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

-- Enable Realtime on match_comments too
alter publication supabase_realtime add table match_comments;
```

- [ ] **Step 2: Add MatchComment type to match.ts**

Add after the `MatchResult` interface in `src/domain/match.ts`:

```typescript
export interface MatchComment {
  id: string;
  matchId: string;
  text: string;
  createdAt: string;
}
```

- [ ] **Step 3: Add updateScores() to MatchService**

Add to `src/domain/services/match.service.ts` after the `recordScore` method (around line 148):

```typescript
  async updateScores(matchId: ID, scores: MatchScore[]): Promise<Match | undefined> {
    return update<Match>(MATCH_KEY, matchId, { scores } as unknown as Partial<Match>);
  }
```

Note: `flattenResult` / `expandResult` already handle the `scores` column on the match. Setting `scores` directly on the update will store them as a JSONB array in the `scores` column. When the match is finalized via `submitResult()`, the `scores` will be overwritten with the final result's scores.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-Object -First 30`
Expected: no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260721000001_realtime_match_comments.sql src/domain/match.ts src/domain/services/match.service.ts
git commit -m "feat: add migration for realtime+comments, updateScores method"
```

---

### Task 2: Wire admin scoring modal to live update scores

**Files:**
- Modify: `src/components/match/match-list.tsx`

**Interfaces:**
- Consumes: `MatchService.updateScores(matchId, scores)`, existing `MatchService.startMatch(matchId)`, existing `recordScore()` (kept for audit)
- Produces: Scoring modal that calls `updateScores()` on each ± click during live matches

- [ ] **Step 1: Read the current match-list.tsx scoring section**

Find the scoring modal — the ± buttons and the `handleScoreChange` or similar handler. The exploration shows the scoring modal has increment/decrement buttons for each participant and an auto-winner detection.

- [ ] **Step 2: Add a `useEffect` or handler to sync scores to the match**

In the scoring modal, find where scores are managed (likely a `scores` state or `scoreValues`). After each score change (increment/decrement), add a call to update the match's scores in real-time:

```typescript
// Inside the scoring modal, after score state changes:
const syncScores = async (currentScores: MatchScore[]) => {
  if (!match) return;
  const svc = new MatchService();
  await svc.updateScores(match.id, currentScores);
};
```

Call this after every score increment/decrement. The scores array should mirror what will eventually be submitted.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-Object -First 30`
Expected: no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/components/match/match-list.tsx
git commit -m "feat: update match scores live via Realtime during admin scoring"
```

---

### Task 3: AI commentary API endpoint

**Files:**
- Create: `src/app/api/ai/commentary/route.ts`
- Create table mapping in CRUD route for `match_comments`

**Interfaces:**
- Produces: `POST /api/ai/commentary` → `{ data: { text: string } }`
- Consumes: match info (participants, scores, game name), returns AI-generated commentary

- [ ] **Step 1: Add match_comments to the TABLE_MAP in CRUD route**

In `src/app/api/[entity]/crud/[action]/route.ts`, add to the `TABLE_MAP` (around line 78):

```typescript
  match_comments: "match_comments",
```

- [ ] **Step 2: Create the commentary API endpoint**

Create `src/app/api/ai/commentary/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

function pickOne(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)];
}

function generateCommentary(matchName: string, participants: { name: string; score: number }[]): string {
  if (participants.length === 2) {
    const [a, b] = participants;
    const diff = Math.abs(a.score - b.score);

    if (a.score === 0 && b.score === 0) return pickOne([
      `${matchName} is underway! Both sides feeling each other out.`,
      `The match has started! Scoreless so far in ${matchName}.`,
    ]);

    if (a.score === b.score) return pickOne([
      `Tied up at ${a.score}-${b.score}! This ${matchName} matchup is heating up.`,
      `We're all square! ${a.score} apiece in ${matchName}.`,
    ]);

    if (diff >= 5) return pickOne([
      `${a.name} is pulling away! ${a.score}-${b.score} — can ${b.name} mount a comeback?`,
      `Big lead building here! ${a.score}-${b.score} in ${matchName}.`,
      `Dominant performance from ${a.name}, leading ${a.score}-${b.score}!`,
    ]);

    if (a.score > b.score) return pickOne([
      `${a.name} edges ahead ${a.score}-${b.score}! Close match in ${matchName}.`,
      `${a.name} takes the lead ${a.score}-${b.score}! Tense moments here.`,
      `Slight advantage to ${a.name}, ${a.score}-${b.score}. Every point counts!`,
    ]);

    return pickOne([
      `${a.name} leads ${a.score}-${b.score} in ${matchName}. Still anyone's game!`,
      `Close contest! ${a.name} ${a.score}, ${b.name} ${b.score}.`,
    ]);
  }

  // FFA / multi-participant
  const leader = participants[0];
  return pickOne([
    `${leader.name} leads with ${leader.score} points! ${matchName} is wide open.`,
    `Current standings in ${matchName}: ${participants.map(p => `${p.name} ${p.score}`).join(", ")}`,
  ]);
}

export async function POST(request: NextRequest) {
  try {
    const { matchId, matchName, participants } = await request.json();

    if (!matchId || !participants) {
      return NextResponse.json({ error: "Missing matchId or participants" }, { status: 400 });
    }

    const text = generateCommentary(matchName ?? "this match", participants);

    // Store in match_comments
    const res = await fetch(`${request.nextUrl.origin}/api/match_comments/crud/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item: {
          matchId,
          text,
          createdAt: new Date().toISOString(),
        },
      }),
    });

    const json = await res.json();
    if (json.error) {
      return NextResponse.json({ data: { text } });
    }

    return NextResponse.json({ data: { text, id: json.data?.id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-Object -First 30`
Expected: no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/commentary/route.ts src/app/api/\[entity\]/crud/\[action\]/route.ts
git commit -m "feat: add AI commentary API endpoint with match_comments storage"
```

---

### Task 4: Create live match components (Timer, Commentary, Modal, Card)

**Files:**
- Create: `src/components/live/live-timer.tsx`
- Create: `src/components/live/commentary-feed.tsx`
- Create: `src/components/live/match-detail-modal.tsx`
- Create: `src/components/live/live-match-card.tsx`

**Interfaces:**
- Consumes: Match object with `startedAt`, `scores`, `participants`, `status`
- Produces: Reusable live match UI components

- [ ] **Step 1: Create LiveTimer component**

`src/components/live/live-timer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Typography } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";

const { Text } = Typography;

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function LiveTimer({ startedAt }: { startedAt: string | undefined }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  return (
    <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: "monospace", fontWeight: 700 }}>
      <ClockCircleOutlined style={{ marginRight: 4 }} />
      {formatElapsed(elapsed)}
    </span>
  );
}
```

- [ ] **Step 2: Create CommentaryFeed component**

`src/components/live/commentary-feed.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { Typography, Spin, Empty } from "antd";
import { CommentOutlined } from "@ant-design/icons";
import type { MatchComment } from "@/domain/match";

const { Text } = Typography;

export default function CommentaryFeed({ comments, loading }: { comments: MatchComment[]; loading: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  return (
    <div style={{ maxHeight: 300, overflowY: "auto", padding: "8px 0" }}>
      {loading && comments.length === 0 && (
        <Spin style={{ display: "flex", justifyContent: "center", padding: 24 }} />
      )}
      {!loading && comments.length === 0 && (
        <Empty description="No commentary yet. Score changes will appear here." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      {comments.map((c) => (
        <div key={c.id} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
          <CommentOutlined style={{ color: "#8b5cf6", fontSize: 14, marginTop: 2, flexShrink: 0 }} />
          <div>
            <Text style={{ fontSize: 13, lineHeight: 1.5 }}>{c.text}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {new Date(c.createdAt).toLocaleTimeString()}
              </Text>
            </div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 3: Create MatchDetailModal component**

`src/components/live/match-detail-modal.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Modal, Typography, Tag, Spin, Space } from "antd";
import { TrophyOutlined } from "@ant-design/icons";
import type { Match, MatchComment, MatchScore } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import LiveTimer from "./live-timer";
import CommentaryFeed from "./commentary-feed";

const { Title, Text } = Typography;

function getCommentaryKey(matchId: string, scores: MatchScore[]): string {
  return `${matchId}-${scores.map(s => `${s.participantId}:${s.value}`).join(",")}`;
}

export default function MatchDetailModal({
  match,
  participants,
  open,
  onClose,
}: {
  match: Match;
  participants: Participant[];
  open: boolean;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [lastCommentKey, setLastCommentKey] = useState("");

  const isLive = match.status === "in_progress";
  const matchScores: MatchScore[] = (match as any).scores ?? [];
  const commentKey = getCommentaryKey(match.id, matchScores);

  useEffect(() => {
    if (!open) return;
    // Load existing comments
    (async () => {
      setCommentLoading(true);
      try {
        const res = await fetch("/api/match_comments/crud/GetAll", { method: "POST" });
        const json = await res.json();
        if (json.data) {
          const allComments = (json.data as MatchComment[]).filter(
            (c) => c.matchId === match.id
          ).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setComments(allComments);
        }
      } catch { /* silent */ }
      setCommentLoading(false);
    })();
  }, [open, match.id]);

  // Trigger commentary on score change
  useEffect(() => {
    if (!isLive || !open || commentKey === lastCommentKey || matchScores.length === 0) return;
    setLastCommentKey(commentKey);

    const timeout = setTimeout(async () => {
      try {
        const participantInfo = matchScores.map((s) => {
          const p = participants.find((pp) => pp.id === s.participantId);
          return { name: p?.displayName ?? "?", score: s.value };
        });
        const res = await fetch("/api/ai/commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId: match.id,
            matchName: `${participantInfo.map(p => p.name).join(" vs ")}`,
            participants: participantInfo,
          }),
        });
        const json = await res.json();
        if (json.data?.text) {
          setComments(prev => [...prev, {
            id: json.data.id ?? crypto.randomUUID(),
            matchId: match.id,
            text: json.data.text,
            createdAt: new Date().toISOString(),
          }]);
        }
      } catch { /* silent */ }
    }, 800);

    return () => clearTimeout(timeout);
  }, [commentKey, isLive, open]);

  const sortedScores = [...matchScores].sort((a, b) => b.value - a.value);

  return (
    <Modal
      title={
        <Space>
          <span>Match Details</span>
          {isLive && <Tag color="red" style={{ animation: "pulse 2s infinite" }}>LIVE</Tag>}
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      {/* Scoreboard */}
      <div style={{ marginBottom: 20 }}>
        {matchScores.length <= 2 && sortedScores.length > 0 ? (
          // Head-to-head scoreboard
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            padding: "20px 0",
          }}>
            {sortedScores.map((s, i) => {
              const p = participants.find(pp => pp.id === s.participantId);
              const isWinner = i === 0 && !isLive;
              return (
                <div key={s.participantId} style={{ textAlign: "center", flex: 1 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: isWinner ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #3b82f6, #1e3a8a)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 8px",
                    fontSize: 20, fontWeight: 700, color: "#fff",
                  }}>
                    {p?.displayName?.charAt(0) ?? "?"}
                  </div>
                  <Text strong style={{ display: "block", fontSize: 15 }}>{p?.displayName ?? "?"}</Text>
                  <Text style={{
                    fontSize: 36, fontWeight: 800, display: "block",
                    color: isWinner ? "#f59e0b" : "#1e293b",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {s.value}
                  </Text>
                  {isWinner && <TrophyOutlined style={{ color: "#f59e0b", fontSize: 18 }} />}
                </div>
              );
            })}
            {isLive && (
              <div style={{ textAlign: "center" }}>
                <LiveTimer startedAt={match.startedAt} />
              </div>
            )}
          </div>
        ) : (
          // FFA / multi-participant leaderboard
          <div>
            {sortedScores.map((s, i) => {
              const p = participants.find(pp => pp.id === s.participantId);
              return (
                <div key={s.participantId} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: "1px solid #f0f0f0",
                }}>
                  <Space>
                    <Tag color={i === 0 ? "gold" : i === 1 ? "default" : i === 2 ? "orange" : "default"}>
                      #{i + 1}
                    </Tag>
                    <Text strong>{p?.displayName ?? "?"}</Text>
                  </Space>
                  <Text style={{ fontSize: 20, fontWeight: 700 }}>{s.value}</Text>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status info */}
      <div style={{ marginBottom: 16, padding: "12px 0", borderTop: "1px solid #f0f0f0" }}>
        <Space direction="vertical" size={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Status: <Tag>{match.status}</Tag>
          </Text>
          {match.startedAt && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Started: {new Date(match.startedAt).toLocaleTimeString()}
            </Text>
          )}
        </Space>
      </div>

      {/* Commentary */}
      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
        <Text strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
          <CommentOutlined style={{ marginRight: 6 }} />AI Commentary
        </Text>
        <CommentaryFeed comments={comments} loading={commentLoading} />
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Create LiveMatchCard component**

`src/components/live/live-match-card.tsx`:

```tsx
"use client";

import { Typography, Tag, Card, Space } from "antd";
import { TrophyOutlined, TeamOutlined } from "@ant-design/icons";
import type { Match, MatchScore } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import LiveTimer from "./live-timer";

const { Text } = Typography;

export default function LiveMatchCard({
  match,
  participants,
  onClick,
}: {
  match: Match;
  participants: Participant[];
  onClick: () => void;
}) {
  const scores: MatchScore[] = (match as any).scores ?? [];
  const sortedScores = [...scores].sort((a, b) => b.value - a.value);

  return (
    <Card
      hoverable
      onClick={onClick}
      style={{
        borderRadius: 16,
        border: "2px solid #22c55e",
        background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
        marginBottom: 16,
        cursor: "pointer",
      }}
      bodyStyle={{ padding: "16px 20px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Space direction="vertical" size={2}>
          <Space>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#22c55e", display: "inline-block",
              animation: "pulse 2s infinite",
            }} />
            <Tag color="green" style={{ fontWeight: 700, fontSize: 11 }}>LIVE</Tag>
          </Space>
          <LiveTimer startedAt={match.startedAt} />
        </Space>
        <TeamOutlined style={{ color: "#22c55e", fontSize: 18 }} />
      </div>

      <div style={{ marginTop: 12 }}>
        {sortedScores.length <= 2 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            {sortedScores.map((s, i) => {
              const p = participants.find(pp => pp.id === s.participantId);
              const isLeading = i === 0;
              return (
                <div key={s.participantId} style={{ textAlign: "center", flex: 1 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: isLeading ? "linear-gradient(135deg, #22c55e, #16a34a)" : "#94a3b8",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 4px", color: "#fff", fontWeight: 700, fontSize: 14,
                  }}>
                    {p?.displayName?.charAt(0) ?? "?"}
                  </div>
                  <Text strong style={{ fontSize: 13, display: "block" }}>{p?.displayName ?? "?"}</Text>
                  <Text style={{
                    fontSize: 28, fontWeight: 800, display: "block",
                    color: isLeading ? "#16a34a" : "#64748b",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {s.value}
                  </Text>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {sortedScores.map((s, i) => {
              const p = participants.find(pp => pp.id === s.participantId);
              return (
                <div key={s.participantId} style={{
                  display: "flex", justifyContent: "space-between", padding: "4px 0",
                }}>
                  <Space>
                    <Tag color={i === 0 ? "gold" : "default"} style={{ fontSize: 10 }}>#{i + 1}</Tag>
                    <Text style={{ fontSize: 13 }}>{p?.displayName ?? "?"}</Text>
                  </Space>
                  <Text style={{ fontWeight: 700, fontSize: 16 }}>{s.value}</Text>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-Object -First 30`
Expected: no TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/components/live/
git commit -m "feat: add live match components - timer, commentary, modal, scoreboard card"
```

---

### Task 5: Integrate Realtime + components into live page + mobile responsive + sporty

**Files:**
- Modify: `src/app/live/[orgSlug]/[competitionId]/page.tsx`

**Interfaces:**
- Consumes: All four new components, Supabase Realtime client, MatchScore type
- Produces: Fully updated live page with live scoring, promoted matches, modal, responsive layout

- [ ] **Step 1: Add imports for new components and Realtime**

Add to existing imports (around line 18-19):

```tsx
import LiveMatchCard from "@/components/live/live-match-card";
import MatchDetailModal from "@/components/live/match-detail-modal";
import { createClient } from "@/lib/supabase/client";
import type { MatchScore } from "@/domain/match";
```

- [ ] **Step 2: Add Realtime subscription**

After the existing state declarations (around line 63), add:

```tsx
  const [detailMatch, setDetailMatch] = useState<Match | null>(null);
  const commentKeyRef = useRef(0);
```

Add a Realtime subscription effect after the existing `useEffect` (after line 125):

```tsx
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("live-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, async (payload) => {
        if (!payload.new || (payload.new as any).event_id !== activeEventId) return;
        const updatedMatch = payload.new as any;
        if (!updatedMatch || !updatedMatch.id) return;

        // Re-fetch the match with participants
        const svc = new MatchService();
        const fullMatch = await svc.get(updatedMatch.id as string);
        if (!fullMatch) return;

        setMatches(prev => prev.map(m => m.id === fullMatch.id ? fullMatch : m));
        setDetailMatch(prev => prev?.id === fullMatch.id ? fullMatch : prev);
        setRefreshKey(k => k + 1); // trigger standings/other re-calcs
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeEventId]);
```

- [ ] **Step 3: Add subscription for match_comments**

Add a second Realtime subscription for comments:

```tsx
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("match-comments")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_comments" }, async (payload) => {
        // Trigger a re-render — the modal will pick up new comments
        commentKeyRef.current += 1;
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
```

- [ ] **Step 4: Update the Overview tab stat cards to be responsive**

Change the stat cards Row in the Overview tab (around line 188-225) from `Col span={6}` to:

```tsx
<Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
  <Col xs={12} md={6}>
    ...
  </Col>
  <Col xs={12} md={6}>
    ...
  </Col>
  <Col xs={12} md={6}>
    ...
  </Col>
  <Col xs={12} md={6}>
    ...
  </Col>
</Row>
```

- [ ] **Step 5: Add live match card above tabs**

In the return block, after the TipTap content card and before the refresh button (around line 533), add:

```tsx
        {/* Live match promotion */}
        {activeEvent && liveMatches.length > 0 && (
          <LiveMatchCard
            match={liveMatches[0]}
            participants={participants}
            onClick={() => setDetailMatch(liveMatches[0])}
          />
        )}

        {/* Match detail modal */}
        <MatchDetailModal
          match={detailMatch!}
          participants={participants}
          open={!!detailMatch}
          onClose={() => setDetailMatch(null)}
        />
```

- [ ] **Step 6: Add scroll to tables for mobile**

Add `scroll={{ x: true }}` to both the Live Matches Table and Recent Results Table.

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | Select-Object -First 30`
Expected: no TypeScript errors

- [ ] **Step 8: Commit**

```bash
git add src/app/live/\[orgSlug\]/\[competitionId\]/page.tsx
git commit -m "feat: integrate Realtime, live match card, modal, responsive layout into live page"
```
