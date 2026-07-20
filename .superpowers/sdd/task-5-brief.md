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
