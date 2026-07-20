-- Fix infinite RLS recursion on organization_members
-- The old policy self-referenced organization_members, causing infinite recursion.
-- New policy only allows users to see their own membership row.
-- This is sufficient because the organizations SELECT policy subquery
-- already filters by member_id = auth.uid(), which this new policy satisfies.

drop policy if exists "Members can view org members" on organization_members;

create policy "Members can view own memberships"
  on organization_members for select using (
    member_id = auth.uid()
  );
