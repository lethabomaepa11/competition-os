-- Fix ambiguous column references in organizations policies.
-- `id` inside subqueries resolved to `organization_members.id` instead of `organizations.id`.
-- Use fully-qualified `organizations.id` to ensure correct outer reference.

drop policy if exists "Organization members can view" on organizations;
create policy "Organization members can view"
  on organizations for select using (
    exists (select 1 from organization_members where organization_id = organizations.id and member_id = auth.uid())
  );

drop policy if exists "Organization admins can update" on organizations;
create policy "Organization admins can update"
  on organizations for update using (
    exists (select 1 from organization_members where organization_id = organizations.id and member_id = auth.uid() and role in ('owner', 'admin'))
  );
