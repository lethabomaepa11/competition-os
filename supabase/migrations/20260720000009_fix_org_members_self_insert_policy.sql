-- Fix ambiguous column reference in "Members can insert self as owner" policy.
-- `organization_id` in the subquery WHERE clause resolves to `om.organization_id`
-- (the inner alias), making `om.organization_id = organization_id` equivalent to
-- `om.organization_id = om.organization_id` — always true, so NOT EXISTS is always false.
-- Fully qualify the outer reference to reference the actual INSERT target row.

drop policy if exists "Members can insert self as owner" on organization_members;

create policy "Members can insert self as owner"
  on organization_members for insert with check (
    member_id = auth.uid()
    and not exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
    )
  );
