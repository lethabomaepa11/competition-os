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
