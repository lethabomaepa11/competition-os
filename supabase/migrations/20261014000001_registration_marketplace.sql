-- Registration marketplace and team identity.
-- Additive defaults keep every existing production row valid.

create type registration_status as enum ('pending', 'approved', 'rejected', 'withdrawn');

alter table competitions
  add column category text not null default 'football',
  add column entry_type participant_type not null default 'individual',
  add column eligibility jsonb not null default '{}',
  add column published_at timestamptz;

update competitions
set published_at = coalesce(updated_at, created_at)
where status in ('published', 'in_progress', 'completed') and published_at is null;

alter table teams
  add column category text not null default 'football',
  add column team_type text not null default 'club',
  add column description text not null default '';

-- A login has one product identity. Operators own one organization; team
-- accounts captain one team; player accounts participate as themselves.
alter table profiles
  add column account_type text not null default 'player'
  check (account_type in ('operator', 'team', 'player'));

update profiles p set account_type = 'operator'
where exists (
  select 1 from organization_members om
  where om.member_id = p.id
);

update profiles p set account_type = 'team'
where p.account_type = 'player'
  and exists (select 1 from teams t where t.member_ids[1] = p.id);

create or replace function prevent_account_type_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.account_type is distinct from new.account_type and auth.role() <> 'service_role' then
    raise exception 'Account type cannot be changed after onboarding';
  end if;
  return new;
end;
$$;

create trigger profiles_lock_account_type
  before update on profiles for each row execute function prevent_account_type_change();

create or replace function handle_new_user()
returns trigger as $$
declare
  selected_type text;
  entity_name text;
  base_slug text;
  final_slug text;
  created_org uuid;
begin
  selected_type := coalesce(new.raw_user_meta_data->>'account_type', 'player');
  if selected_type not in ('operator', 'team', 'player') then selected_type := 'player'; end if;

  insert into public.profiles (id, email, display_name, account_type)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.email), selected_type);

  if selected_type = 'operator' then
    entity_name := nullif(trim(new.raw_user_meta_data->>'organization_name'), '');
    if entity_name is null then raise exception 'Organization name is required'; end if;
    base_slug := trim(both '-' from regexp_replace(lower(entity_name), '[^a-z0-9]+', '-', 'g'));
    if base_slug = '' then base_slug := 'organization'; end if;
    final_slug := base_slug;
    if exists (select 1 from public.organizations where slug = final_slug) then
      final_slug := base_slug || '-' || substring(md5(new.id::text), 1, 6);
    end if;
    insert into public.organizations (name, slug) values (entity_name, final_slug) returning id into created_org;
    insert into public.organization_members (organization_id, member_id, role, permissions)
      values (created_org, new.id, 'owner', '{}');
  elsif selected_type = 'team' then
    entity_name := nullif(trim(new.raw_user_meta_data->>'team_name'), '');
    if entity_name is null then raise exception 'Team name is required'; end if;
    insert into public.teams (name, category, team_type, description, member_ids)
    values (
      entity_name,
      coalesce(nullif(new.raw_user_meta_data->>'category', ''), 'football'),
      coalesce(nullif(new.raw_user_meta_data->>'team_type', ''), 'club'),
      '',
      array[new.id]
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop policy if exists "Anyone can create organizations" on organizations;
create policy "Operators can create their sole organization"
  on organizations for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'operator')
    and not exists (select 1 from organization_members om where om.member_id = auth.uid())
  );

drop policy if exists "auth_ins" on teams;
drop policy if exists "auth_sel" on teams;
drop policy if exists "auth_upd" on teams;
drop policy if exists "auth_del" on teams;
create or replace function public.account_has_captain_team(profile_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from teams t where t.member_ids[1] = profile_id);
$$;
create policy "Team accounts can create their sole team"
  on teams for insert with check (
    member_ids[1] = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'team')
    and not public.account_has_captain_team(auth.uid())
  );
create policy "Captains can update their team"
  on teams for update using (member_ids[1] = auth.uid()) with check (member_ids[1] = auth.uid());
create policy "Captains can delete their team"
  on teams for delete using (member_ids[1] = auth.uid());
create table competition_registrations (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  registrant_type participant_type not null,
  member_id uuid references profiles(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  status registration_status not null default 'pending',
  registration_note text not null default '',
  review_note text not null default '',
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competition_registration_owner check (
    (registrant_type = 'individual' and member_id is not null and team_id is null)
    or (registrant_type = 'team' and team_id is not null)
  )
);

create unique index competition_registrations_member_unique
  on competition_registrations (competition_id, member_id)
  where registrant_type = 'individual';
create unique index competition_registrations_team_unique
  on competition_registrations (competition_id, team_id)
  where registrant_type = 'team';
create index competition_registrations_queue_idx
  on competition_registrations (competition_id, status, created_at);

alter table competition_registrations enable row level security;

create policy "Applicants and operators can view registrations"
  on competition_registrations for select using (
    member_id = auth.uid()
    or exists (select 1 from teams t where t.id = competition_registrations.team_id and auth.uid() = any(t.member_ids))
    or exists (
      select 1 from competitions c
      join organization_members om on om.organization_id = c.organization_id
      where c.id = competition_registrations.competition_id and om.member_id = auth.uid()
    )
  );

create policy "Players and captains can apply"
  on competition_registrations for insert with check (
    status = 'pending' and (
      (registrant_type = 'individual' and member_id = auth.uid())
      or exists (select 1 from teams t where t.id = competition_registrations.team_id and t.member_ids[1] = auth.uid())
    )
  );

create policy "Organization operators can review registrations"
  on competition_registrations for update using (
    exists (
      select 1 from competitions c
      join organization_members om on om.organization_id = c.organization_id
      where c.id = competition_registrations.competition_id
        and om.member_id = auth.uid()
        and om.role in ('owner', 'admin', 'moderator')
    )
  ) with check (
    exists (
      select 1 from competitions c
      join organization_members om on om.organization_id = c.organization_id
      where c.id = competition_registrations.competition_id
        and om.member_id = auth.uid()
        and om.role in ('owner', 'admin', 'moderator')
    )
  );

create trigger update_competition_registrations_updated_at
  before update on competition_registrations for each row execute function update_updated_at();

create or replace function public.operator_can_view_team(target_team_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from competition_registrations cr
    join competitions c on c.id = cr.competition_id
    join organization_members om on om.organization_id = c.organization_id
    where cr.team_id = target_team_id and om.member_id = auth.uid()
  );
$$;

create policy "Teams are visible in their competition context"
  on teams for select using (
    auth.uid() = any(member_ids)
    or exists (
      select 1 from participants p
      join events e on e.id = p.event_id
      join competitions c on c.id = e.competition_id
      where p.team_id = teams.id and c.visibility = 'public'
    )
    or public.operator_can_view_team(id)
  );

create or replace function public.can_view_competition_profile(target_profile_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from teams t
    where auth.uid() = any(t.member_ids) and target_profile_id = any(t.member_ids)
  ) or exists (
    select 1 from competition_registrations cr
    join competitions c on c.id = cr.competition_id
    join organization_members om on om.organization_id = c.organization_id
    where cr.member_id = target_profile_id and om.member_id = auth.uid()
  );
$$;

drop policy if exists "Users can read own profile" on profiles;
create policy "Users can read competition profiles"
  on profiles for select using (
    auth.uid() = id or public.share_org_with(id) or public.can_view_competition_profile(id)
  );

create table team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  email text,
  invited_by uuid not null references profiles(id) on delete cascade,
  status invite_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index team_invites_team_idx on team_invites (team_id, status, created_at desc);
alter table team_invites enable row level security;

create policy "Captains can manage team invites"
  on team_invites for all using (
    exists (select 1 from teams t where t.id = team_invites.team_id and t.member_ids[1] = auth.uid())
  ) with check (
    invited_by = auth.uid()
    and exists (select 1 from teams t where t.id = team_invites.team_id and t.member_ids[1] = auth.uid())
  );

create or replace function get_team_invite(invite_token text)
returns table (team_name text, category text, team_type text, status invite_status, expires_at timestamptz)
language sql security definer set search_path = public
as $$
  select t.name, t.category, t.team_type, i.status, i.expires_at
  from team_invites i join teams t on t.id = i.team_id
  where i.token = invite_token
  limit 1;
$$;

create or replace function accept_team_invite(invite_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  invite_row team_invites%rowtype;
  account_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into invite_row from team_invites where token = invite_token for update;
  if invite_row.id is null or invite_row.status <> 'pending' or invite_row.expires_at <= now() then
    raise exception 'This invite is invalid or has expired';
  end if;
  account_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if invite_row.email is not null and lower(invite_row.email) <> account_email then
    raise exception 'This invite was issued to another email address';
  end if;
  update teams
  set member_ids = case when auth.uid() = any(member_ids) then member_ids else array_append(member_ids, auth.uid()) end,
      updated_at = now()
  where id = invite_row.team_id;
  update team_invites
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  where id = invite_row.id;
  return invite_row.team_id;
end;
$$;

grant execute on function get_team_invite(text) to anon, authenticated;
grant execute on function accept_team_invite(text) to authenticated;

create or replace function set_competition_published_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published' or new.published_at is null) then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger competitions_set_published_at
  before update on competitions for each row execute function set_competition_published_at();
