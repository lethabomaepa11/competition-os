-- After creating an organization, auto-add the creator as an owner member.
-- Without this, the creator can't SELECT the org they just created because
-- the RLS SELECT policy requires membership in organization_members.

create or replace function public.add_creator_as_owner()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.uid() is not null then
    insert into public.organization_members (organization_id, member_id, role, permissions)
    values (new.id, auth.uid(), 'owner', '{}');
  end if;
  return new;
end;
$$;

create trigger after_organization_insert
  after insert on public.organizations
  for each row execute function public.add_creator_as_owner();
