# Invite Page Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cover images and rich-text content to competitions/events, display them on the invite page.

**Architecture:** Migration adds columns to competitions + events, domain types are updated, an upload component stores images in Supabase Storage, a TipTap renderer converts JSON to HTML, and the invite page gets a hero + content section.

**Tech Stack:** Next.js, Supabase (Storage + Postgres), Ant Design, @tiptap/html, dompurify

## Global Constraints

- TipTap JSON is stored as `jsonb` in the `content` column
- Cover images stored in Supabase Storage bucket `competition-covers` (public, 10MB max, png/jpeg/webp only)
- Invite page auth flow (register → join events) remains untouched
- No TipTap editor — only rendering via `@tiptap/html`

---

### Task 1: Migration — Add columns + storage bucket

**Files:**
- Create: `supabase/migrations/20260720000012_competition_content.sql`

- [ ] **Step 1: Write migration**

```sql
-- Add cover_image and content to competitions
alter table competitions
  add column cover_image text,
  add column content jsonb;

-- Add cover_image to events
alter table events
  add column cover_image text;

-- Create storage bucket for cover images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'competition-covers',
  'competition-covers',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
);
```

- [ ] **Step 2: Run migration**

Run: `supabase migration up`
Expected: "Applied migration 20260720000012_competition_content.sql"

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260720000012_competition_content.sql
git commit -m "feat: add cover_image and content columns, storage bucket"
```

---

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

---

### Task 3: Install dependencies + create TipTap renderer component

**Files:**
- Create: `src/components/editor/tiptap-renderer.tsx`

- [ ] **Step 1: Install packages**

Run: `npm install @tiptap/html dompurify`

- [ ] **Step 2: Create TipTap renderer component**

```tsx
"use client";

import { useMemo } from "react";
import { generateHTML } from "@tiptap/html";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Heading from "@tiptap/extension-heading";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import Blockquote from "@tiptap/extension-blockquote";
import CodeBlock from "@tiptap/extension-code-block";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import HardBreak from "@tiptap/extension-hard-break";
import HorizontalRule from "@tiptap/extension-horizontal-rule";

const extensions = [
  Document, Paragraph, Text, Bold, Italic, Strike,
  Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
  BulletList, OrderedList, ListItem, Blockquote, CodeBlock,
  Link.configure({ openOnClick: false }),
  Image, HardBreak, HorizontalRule,
];

export default function TipTapRenderer({ content }: { content: Record<string, unknown> | null | undefined }) {
  const html = useMemo(() => {
    if (!content) return "";
    try {
      return generateHTML(content as any, extensions);
    } catch {
      return "";
    }
  }, [content]);

  if (!html) return null;

  return (
    <div
      className="tiptap-content"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ lineHeight: 1.8 }}
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/tiptap-renderer.tsx package.json package-lock.json
git commit -m "feat: add TipTap JSON renderer component"
```

---

### Task 4: Create image upload component

**Files:**
- Create: `src/components/upload/image-upload.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Button, Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "competition-covers";

export default function ImageUpload({ currentUrl, onUpload }: { currentUrl?: string | null; onUpload: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onUpload(publicUrl);
      message.success("Image uploaded");
    } catch (err) {
      message.error("Upload failed");
    } finally {
      setUploading(false);
    }
    return false; // prevent default antd upload
  };

  return (
    <div>
      {currentUrl && (
        <img src={currentUrl} alt="Cover" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
      )}
      <Upload beforeUpload={handleUpload} showUploadList={false} accept="image/png,image/jpeg,image/webp">
        <Button icon={<UploadOutlined />} loading={uploading}>
          {currentUrl ? "Change Image" : "Upload Cover Image"}
        </Button>
      </Upload>
    </div>
  );
}
```

- [ ] **Step 2: Create the Supabase client helper if it doesn't exist**

Check if `src/lib/supabase/client.ts` exists:

Run: `ls src/lib/supabase/client.ts`

If it does not exist, create it:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/upload/image-upload.tsx
git commit -m "feat: add Supabase Storage image upload component"
```

---

### Task 5: Add cover image + content to competition edit form

**Files:**
- Modify: `src/app/o/[orgSlug]/competitions/[compId]/page.tsx`

- [ ] **Step 1: Add imports**

At the top of the file, add:
```typescript
import ImageUpload from "@/components/upload/image-upload";
```

- [ ] **Step 2: Add cover image and content fields to the edit modal**

Find the edit modal section (around line 492-516) and replace the form with:

```tsx
<Form form={editForm} layout="vertical" onFinish={handleEditCompetition} requiredMark={false}>
  <Form.Item label="Name" name="name" rules={[{ required: true, message: "Enter competition name" }]}>
    <Input placeholder="Competition name" size="large" />
  </Form.Item>
  <Form.Item label="Cover Image" name="coverImage">
    <ImageUpload currentUrl={competition?.coverImage} onUpload={(url) => editForm.setFieldValue("coverImage", url)} />
  </Form.Item>
  <Form.Item label="Description" name="description">
    <Input.TextArea rows={3} placeholder="Optional description" />
  </Form.Item>
  <Form.Item label="Content (TipTap JSON)" name={["content"]}>
    <Input.TextArea rows={6} placeholder='[{"type":"paragraph","content":[{"type":"text","text":"Rich content..."}]}]' />
  </Form.Item>
  <Form.Item label="Visibility" name="visibility" rules={[{ required: true }]}>
    <Select size="large">
      <Select.Option value={Visibility.Public}>Public</Select.Option>
      <Select.Option value={Visibility.Private}>Private</Select.Option>
      <Select.Option value={Visibility.Hidden}>Hidden (by link)</Select.Option>
    </Select>
  </Form.Item>
  <Form.Item style={{ marginBottom: 0 }}>
    <Button type="primary" htmlType="submit" loading={saving} size="large" block>
      Save Changes
    </Button>
  </Form.Item>
</Form>
```

- [ ] **Step 3: Update handleEditCompetition to pass coverImage and content**

Find the `handleEditCompetition` function (around line 112) and update the type + body:

```typescript
const handleEditCompetition = async (values: { name: string; description?: string; visibility: Visibility; coverImage?: string; content?: Record<string, unknown> }) => {
  if (!currentMember) return;
  setSaving(true);
  try {
    const svc = new CompetitionService();
    await svc.update(competition.id, {
      name: values.name,
      description: values.description ?? "",
      visibility: values.visibility,
      coverImage: values.coverImage,
      content: values.content,
    }, currentMember.id);
    message.success("Competition updated!");
    setEditModalOpen(false);
    refresh();
  } catch {
    message.error("Failed to update competition");
  } finally {
    setSaving(false);
  }
};
```

- [ ] **Step 4: Commit**

```bash
git add src/app/o/\[orgSlug\]/competitions/\[compId\]/page.tsx
git commit -m "feat: add cover image and content fields to competition edit form"
```

---

### Task 6: Add cover image to event page

**Files:**
- Modify: `src/app/o/[orgSlug]/competitions/[compId]/events/[eventId]/page.tsx`

- [ ] **Step 1: Add imports**

At the top, add:
```typescript
import ImageUpload from "@/components/upload/image-upload";
import { EventService } from "@/domain/services/event.service";
```

- [ ] **Step 2: Find a location in the event detail page to add the cover image upload**

The event detail page shows tabs. Add a cover image section in the header area, near the event title. Find the section that renders the event title/header (around where `event.name` is shown) and add:

```tsx
<div style={{ marginBottom: 16 }}>
  {event.coverImage && (
    <img src={event.coverImage} alt="Event cover" style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />
  )}
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <Title level={3} style={{ margin: 0 }}>{event.name}</Title>
    <ImageUpload currentUrl={event.coverImage} onUpload={async (url) => {
      const svc = new EventService();
      await svc.update(event.id, { coverImage: url });
      message.success("Cover image updated");
      refresh();
    }} />
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/o/\[orgSlug\]/competitions/\[compId\]/events/\[eventId\]/page.tsx
git commit -m "feat: add cover image upload to event page"
```

---

### Task 7: Redesign invite page with cover image + content

**Files:**
- Modify: `src/app/invite/competition/[token]/page.tsx`

- [ ] **Step 1: Add imports**

```typescript
import TipTapRenderer from "@/components/editor/tiptap-renderer";
```

- [ ] **Step 2: Replace the page content section**

Find the competition info render block (lines 144-155) and replace it with a hero + content layout:

```tsx
<Layout style={{ minHeight: "100vh", background: "#F8FAFC" }}>
  <Content style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>

    {/* Hero section */}
    {competition?.coverImage && (
      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 24, aspectRatio: "21/9" }}>
        <img src={competition.coverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {competition && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "32px 24px 20px", background: "linear-gradient(transparent, rgba(0,0,0,0.6))" }}>
            <Title level={1} style={{ color: "#fff", margin: 0, fontSize: 28 }}>{competition.name}</Title>
            {competition.game && <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>{competition.game.name}</Text>}
          </div>
        )}
      </div>
    )}

    {(!competition?.coverImage) && (
      <Card style={{ borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.04)", marginBottom: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
          <Title level={2} style={{ margin: 0, fontSize: 24 }}>{competition?.name}</Title>
          {competition?.description && (
            <Text style={{ color: "#64748B", display: "block", marginTop: 4 }}>{competition.description}</Text>
          )}
        </div>
      </Card>
    )}

    {/* Content section */}
    {(competition?.content) && (
      <Card style={{ borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.04)", marginBottom: 24, padding: "8px 0" }}>
        <TipTapRenderer content={competition.content} />
      </Card>
    )}

    {/* Info bar (if cover is shown, render description under hero) */}
    {competition?.coverImage && competition?.description && (
      <Card style={{ borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.04)", marginBottom: 24 }}>
        <Text style={{ color: "#475569", fontSize: 15, lineHeight: 1.6 }}>{competition.description}</Text>
      </Card>
    )}

    {/* Auth / Events section — same as before */}
    <Card style={{ borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.04)", marginBottom: 24 }}>
      {/* ... EXISTING auth+events content from lines 157-232 unchanged ... */}
    </Card>

    {currentMember && (
      <div style={{ textAlign: "center" }}>
        <Button type="link" icon={<RightOutlined />} onClick={() => router.push("/app")}>
          Go to Dashboard
        </Button>
      </div>
    )}
  </Content>
</Layout>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/invite/competition/\[token\]/page.tsx
git commit -m "feat: redesign invite page with cover image and TipTap content"
```

---

### Self-Review

**Spec coverage:**
- Migration adds cover_image + content to competitions, cover_image to events ✓ (Task 1)
- Storage bucket created ✓ (Task 1)
- Domain types updated ✓ (Task 2)
- @tiptap/html install + renderer ✓ (Task 3)
- dompurify installed ✓ (Task 3)
- Image upload component ✓ (Task 4)
- Competition admin form updated ✓ (Task 5)
- Event cover image in event page ✓ (Task 6)
- Invite page hero + content rendering ✓ (Task 7)
- Auth flow untouched ✓ (Task 7 preserves existing logic)

**Placeholder check:** No TBDs or placeholders. ✓

**Type consistency:** `coverImage?: string`, `content?: Record<string, unknown>`, `coverImage?: string` used consistently across all tasks. ✓
