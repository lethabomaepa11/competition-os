create or replace function get_organization_invite(invite_token text)
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  invite_email text,
  invite_role member_role,
  invite_status invite_status,
  inviter_name text
)
language sql
security definer
set search_path = public
as $$
  select o.id, o.name, o.slug, i.email, i.role, i.status, p.display_name
  from invites i
  join organizations o on o.id = i.organization_id
  left join profiles p on p.id = i.invited_by
  where i.token = invite_token
  limit 1;
$$;

create or replace function accept_organization_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row invites%rowtype;
  account_email text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to accept this invitation';
  end if;

  select * into invite_row
  from invites
  where token = invite_token
  for update;

  if invite_row.id is null then
    raise exception 'This invitation could not be found';
  end if;

  account_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if account_email = '' or lower(invite_row.email) <> account_email then
    raise exception 'Sign in with % to accept this invitation', invite_row.email;
  end if;

  if invite_row.status = 'accepted' then
    if exists (
      select 1 from organization_members
      where organization_id = invite_row.organization_id
        and member_id = auth.uid()
    ) then
      return invite_row.organization_id;
    end if;
    raise exception 'This invitation has already been accepted';
  end if;

  if invite_row.status <> 'pending' then
    raise exception 'This invitation is %', invite_row.status;
  end if;

  insert into organization_members (organization_id, member_id, role)
  values (invite_row.organization_id, auth.uid(), invite_row.role)
  on conflict (organization_id, member_id) do nothing;

  update invites
  set status = 'accepted', accepted_at = now()
  where id = invite_row.id;

  return invite_row.organization_id;
end;
$$;

grant execute on function get_organization_invite(text) to anon, authenticated;
revoke all on function accept_organization_invite(text) from public, anon;
grant execute on function accept_organization_invite(text) to authenticated;

drop policy if exists "auth_ins" on invites;
drop policy if exists "auth_sel" on invites;
drop policy if exists "auth_upd" on invites;
drop policy if exists "auth_del" on invites;

create policy "Organization members can view invites"
  on invites for select to authenticated
  using (exists (
    select 1 from organization_members om
    where om.organization_id = invites.organization_id and om.member_id = auth.uid()
  ));

create policy "Organization admins can create invites"
  on invites for insert to authenticated
  with check (exists (
    select 1 from organization_members om
    where om.organization_id = invites.organization_id
      and om.member_id = auth.uid() and om.role in ('owner', 'admin')
  ));

create policy "Organization admins can update invites"
  on invites for update to authenticated
  using (exists (
    select 1 from organization_members om
    where om.organization_id = invites.organization_id
      and om.member_id = auth.uid() and om.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from organization_members om
    where om.organization_id = invites.organization_id
      and om.member_id = auth.uid() and om.role in ('owner', 'admin')
  ));
