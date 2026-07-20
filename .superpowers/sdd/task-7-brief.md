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
