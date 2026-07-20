-- Fix remaining RLS issues:
--   1. organization_members SELECT policy was too restrictive (only own row)
--   2. profiles SELECT policy blocked reading other org members
--   3. organization_members DELETE policy had self-comparison bug
--
-- Use security definer helper functions to avoid circular RLS references.

-- Helper: check if auth user belongs to an org (bypasses RLS)
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and member_id = auth.uid()
  );
$$;

-- Helper: check if auth user and target profile share any org
create or replace function public.share_org_with(target_profile_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.organization_members om1
    join public.organization_members om2 on om1.organization_id = om2.organization_id
    where om1.member_id = auth.uid() and om2.member_id = target_profile_id
  );
$$;

-- ── organization_members ──
drop policy if exists "Members can view org members" on organization_members;
drop policy if exists "Members can view own memberships" on organization_members;

create policy "Members can view org members"
  on organization_members for select using (
    member_id = auth.uid()
    or public.is_org_member(organization_id)
  );

-- Fix delete policy: use correct outer reference and security definer helper
drop policy if exists "Admins can delete members" on organization_members;

create policy "Admins can delete members"
  on organization_members for delete using (
    public.is_org_member(organization_id)
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = organization_members.organization_id
        and om.member_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

-- ── profiles ──
-- Allow reading own profile or profile of a user in the same org
drop policy if exists "Users can read own profile" on profiles;

create policy "Users can read own profile"
  on profiles for select using (
    auth.uid() = id
    or public.share_org_with(id)
  );
