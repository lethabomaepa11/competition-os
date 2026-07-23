# My Events Page & API Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a "My Events" page for participants and add focused API endpoints that query Supabase with proper filters instead of client-side full-table scans.

**Architecture:** Add two server-side API routes (`/api/me/events`, `/api/me/organizations`) that use Supabase server client with `.eq()`/`.in()` filters. Create `/app/events` page fetching from `/api/me/events`. Add navigation link from dashboard to events page.

**Tech Stack:** Next.js App Router, Supabase server client (`@supabase/ssr`), Ant Design, TypeScript

## Global Constraints

- All Supabase queries in API routes use `.eq()`/`.in()` filters — never fetch all rows
- API routes use `createServerClient` from `@supabase/ssr` (same pattern as `src/app/api/[entity]/crud/[action]/route.ts`)
- Client pages do a single `fetch()` to the API route, no direct service imports
- Response format: `{ data: ... }` on success, `{ error: "message" }` on failure
- Dashboard layout: same Header + Content pattern as existing `/app/page.tsx`

---

### Task 1: Create `/api/me/events` endpoint

**Files:**
- Create: `src/app/api/me/events/route.ts`

**Interfaces:**
- Consumes: Supabase `profiles`, `participants`, `events`, `competitions`, `organizations` tables
- Produces: `GET /api/me/events` → `{ data: MyEvent[] }` where `MyEvent = { participantId, eventId, eventName, eventStatus, eventFormat, competitionId, competitionName, organizationId, organizationName, organizationSlug, registeredAt }`

- [ ] **Create the API route file**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function mapKeys(obj: unknown, convert: (k: string) => string): unknown {
  if (Array.isArray(obj)) return obj.map((v) => mapKeys(v, convert));
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[convert(k)] = mapKeys(v, convert);
    }
    return result;
  }
  return obj;
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          pendingCookies.length = 0;
          pendingCookies.push(...cookiesToSet);
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: participants, error: partError } = await supabase
      .from("participants")
      .select("*")
      .eq("member_id", user.id)
      .eq("status", "active");

    if (partError) return NextResponse.json({ error: partError.message }, { status: 500 });
    if (!participants || participants.length === 0) {
      const response = NextResponse.json({ data: [] });
      for (const { name, value } of pendingCookies) response.cookies.set(name, value);
      return response;
    }

    const eventIds = [...new Set(participants.map((p) => p.event_id))];

    const { data: events, error: evtError } = await supabase
      .from("events")
      .select("*")
      .in("id", eventIds);

    if (evtError) return NextResponse.json({ error: evtError.message }, { status: 500 });

    const compIds = [...new Set((events ?? []).map((e) => e.competition_id))];

    const { data: competitions, error: compError } = await supabase
      .from("competitions")
      .select("*")
      .in("id", compIds);

    if (compError) return NextResponse.json({ error: compError.message }, { status: 500 });

    const orgIds = [...new Set((competitions ?? []).map((c) => c.organization_id))];

    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .in("id", orgIds);

    if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 });

    const compMap = new Map((competitions ?? []).map((c) => [c.id, c]));
    const orgMap = new Map((organizations ?? []).map((o) => [o.id, o]));

    const result = participants.map((p) => {
      const evt = (events ?? []).find((e) => e.id === p.event_id);
      const comp = evt ? compMap.get(evt.competition_id) : undefined;
      const org = comp ? orgMap.get(comp.organization_id) : undefined;
      return {
        participantId: p.id,
        eventId: p.event_id,
        eventName: evt?.name ?? "Unknown Event",
        eventStatus: evt?.status ?? "unknown",
        eventFormat: evt?.format ?? "unknown",
        competitionId: comp?.id ?? "",
        competitionName: comp?.name ?? "Unknown Competition",
        organizationId: org?.id ?? "",
        organizationName: org?.name ?? "Unknown Organization",
        organizationSlug: org?.slug ?? "",
        registeredAt: p.registered_at,
      };
    });

    const response = NextResponse.json({ data: result });
    for (const { name, value } of pendingCookies) response.cookies.set(name, value);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Verify the route compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: no TypeScript errors

- [ ] **Commit**

```bash
git add src/app/api/me/events/route.ts
git commit -m "feat: add /api/me/events endpoint with server-side joining"
```

---

### Task 2: Create `/app/events` page

**Files:**
- Create: `src/app/app/events/page.tsx`

**Interfaces:**
- Consumes: `GET /api/me/events` → `{ data: MyEvent[] }`
- Produces: Renders "My Events" page with event cards
- Navigation: N/A (separate page)

- [ ] **Create the "My Events" page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layout, Typography, Card, Row, Col, Spin, Empty, Tag, Space, Button, Avatar } from "antd";
import { TrophyOutlined, LogoutOutlined, RightOutlined, TeamOutlined, PlusOutlined } from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

interface MyEvent {
  participantId: string;
  eventId: string;
  eventName: string;
  eventStatus: string;
  eventFormat: string;
  competitionId: string;
  competitionName: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  registeredAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "default",
  open: "blue",
  in_progress: "green",
  completed: "purple",
  cancelled: "red",
};

function MyEventsInner() {
  const router = useRouter();
  const { currentMember, organizations, logout } = useApp();
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentMember) { router.push("/login"); return; }
    (async () => {
      try {
        const res = await fetch("/api/me/events");
        const json = await res.json();
        if (json.data) setEvents(json.data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [currentMember, router]);

  if (!currentMember) return null;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", position: "sticky", top: 0, zIndex: 10,
      }}>
        <Space>
          <img src="/logo.jpg" alt="CompetitionOS" style={{ height: 40 }} />
          <Title level={4} style={{ margin: 0, fontWeight: 700 }}>CompetitionOS</Title>
        </Space>
        <Space>
          <Button type="text" style={{ color: "#fff" }} onClick={() => router.push("/app")}>
            Dashboard
          </Button>
          <Avatar size={32} style={{ fontSize: 13, fontWeight: 600 }}>
            {currentMember.displayName.charAt(0).toUpperCase()}
          </Avatar>
          <Text style={{ fontWeight: 500, color: "#fff" }}>{currentMember.displayName}</Text>
          <Button type="text" icon={<LogoutOutlined />} style={{ color: "#fff" }}
            onClick={() => { logout(); router.push("/login"); }}
          />
        </Space>
      </Header>

      <Content style={{ padding: "48px 32px", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36 }}>
          <div>
            <Text type="secondary" style={{ fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              My Events
            </Text>
            <Title level={2} style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 700 }}>
              Events You&apos;ve Joined
            </Title>
          </div>
          <Button icon={<PlusOutlined />} onClick={() => router.push("/app")}>
            Browse Competitions
          </Button>
        </div>

        {loading ? (
          <Spin style={{ display: "flex", justifyContent: "center", marginTop: 60 }} />
        ) : events.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <Empty
              description={
                <div>
                  <Text style={{ fontSize: 15, display: "block", marginBottom: 4 }}>You haven&apos;t joined any events yet</Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Join a competition to see your events here
                  </Text>
                </div>
              }
            >
              <Button type="primary" size="large" onClick={() => router.push("/app")} style={{ marginTop: 8 }}>
                Browse Organizations
              </Button>
            </Empty>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {events.map((evt) => (
              <Col xs={24} sm={12} key={evt.participantId}>
                <Card
                  hoverable
                  className="card-hover"
                  onClick={() => {
                    if (evt.organizationSlug && evt.competitionId) {
                      router.push(`/live/${evt.organizationSlug}/${evt.competitionId}`);
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                      <Avatar size={48} icon={<TrophyOutlined />} style={{ fontSize: 20, flexShrink: 0 }} />
                      <div>
                        <Title level={4} style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{evt.eventName}</Title>
                        <Tag color={STATUS_COLORS[evt.eventStatus] ?? "default"} style={{ marginTop: 4 }}>
                          {evt.eventStatus?.replace(/_/g, " ")}
                        </Tag>
                        <div style={{ marginTop: 8 }}>
                          <Text style={{ display: "block", fontSize: 13, color: "#64748b" }}>
                            <TeamOutlined style={{ marginRight: 4 }} />
                            {evt.competitionName}
                          </Text>
                          <Text style={{ display: "block", fontSize: 12, color: "#94a3b8" }}>
                            {evt.organizationName}
                          </Text>
                        </div>
                      </div>
                    </div>
                    <Button type="text" icon={<RightOutlined />} />
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Content>
    </Layout>
  );
}

export default function MyEventsPage() {
  return (
    <AppProvider>
      <MyEventsInner />
    </AppProvider>
  );
}
```

- [ ] **Verify the page compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: no TypeScript errors

- [ ] **Commit**

```bash
git add src/app/app/events/page.tsx
git commit -m "feat: add My Events page showing registered events"
```

---

### Task 3: Add "My Events" navigation link to dashboard header

**Files:**
- Modify: `src/app/app/page.tsx` — add "My Events" button in the header next to the avatar

- [ ] **Add navigation link in dashboard header**

Find the header Space near the end of the component (around line 62-75 in `src/app/app/page.tsx`). Add a "My Events" button before the logout button:

Edit the header Space to include a My Events link:

```tsx
<Space>
  <Button type="text" style={{ color: "#fff" }} onClick={() => router.push("/app/events")}>
    My Events
  </Button>
  <Avatar size={32} style={{ fontSize: 13, fontWeight: 600 }}>
    {currentMember.displayName.charAt(0).toUpperCase()}
  </Avatar>
  <Text style={{ fontWeight: 500, color: "#fff" }}>{currentMember.displayName}</Text>
  <Button type="text" icon={<LogoutOutlined />} style={{ color: "#fff" }}
    onClick={() => { logout(); router.push("/login"); }}
  />
</Space>
```

- [ ] **Verify the page compiles and the button is visible**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: no errors

- [ ] **Commit**

```bash
git add src/app/app/page.tsx
git commit -m "feat: add My Events navigation link to dashboard header"
```

---

### Task 4: Create `/api/me/organizations` endpoint

**Files:**
- Create: `src/app/api/me/organizations/route.ts`

**Interfaces:**
- Consumes: Supabase `organization_members`, `organizations` tables
- Produces: `GET /api/me/organizations` → `{ data: Organization[] }`

- [ ] **Create the API route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          pendingCookies.length = 0;
          pendingCookies.push(...cookiesToSet);
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: memberships, error: memError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("member_id", user.id);

    if (memError) return NextResponse.json({ error: memError.message }, { status: 500 });

    if (!memberships || memberships.length === 0) {
      const response = NextResponse.json({ data: [] });
      for (const { name, value } of pendingCookies) response.cookies.set(name, value);
      return response;
    }

    const orgIds = memberships.map((m) => m.organization_id);

    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .in("id", orgIds);

    if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 });

    const result = (organizations ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      logoUrl: o.logo_url,
      settings: o.settings,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    }));

    const response = NextResponse.json({ data: result });
    for (const { name, value } of pendingCookies) response.cookies.set(name, value);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Verify the route compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: no errors

- [ ] **Commit**

```bash
git add src/app/api/me/organizations/route.ts
git commit -m "feat: add /api/me/organizations endpoint with server-side filtering"
```


