-- Blueprints (saved competition+event configurations)
create table blueprints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  config jsonb not null default '{}',
  version int not null default 1,
  is_public bool not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table blueprints enable row level security;

create policy "Organization members can view blueprints"
  on blueprints for select using (
    exists (select 1 from organization_members where organization_id = blueprints.organization_id and member_id = auth.uid())
    or is_public = true
  );
create policy "Organization admins can manage blueprints"
  on blueprints for insert with check (
    exists (select 1 from organization_members where organization_id = blueprints.organization_id and member_id = auth.uid() and role in ('owner', 'admin'))
  );
create policy "Organization admins can update blueprints"
  on blueprints for update using (
    exists (select 1 from organization_members where organization_id = blueprints.organization_id and member_id = auth.uid() and role in ('owner', 'admin'))
  );
create policy "Organization admins can delete blueprints"
  on blueprints for delete using (
    exists (select 1 from organization_members where organization_id = blueprints.organization_id and member_id = auth.uid() and role in ('owner', 'admin'))
  );

-- Awarded Points (manual points awarded by admins)
create table awarded_points (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  points numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table awarded_points enable row level security;

create policy "Event participants can view awarded points"
  on awarded_points for select using (
    exists (select 1 from participants where id = awarded_points.participant_id and member_id = auth.uid())
  );
create policy "Organization admins can manage awarded points"
  on awarded_points for insert with check (
    exists (select 1 from organization_members om join events e on e.competition_id in (select id from competitions where organization_id = om.organization_id) where e.id = awarded_points.event_id and om.member_id = auth.uid() and om.role in ('owner', 'admin'))
  );
create policy "Organization admins can delete awarded points"
  on awarded_points for delete using (
    exists (select 1 from organization_members om join events e on e.competition_id in (select id from competitions where organization_id = om.organization_id) where e.id = awarded_points.event_id and om.member_id = auth.uid() and om.role in ('owner', 'admin'))
  );

create trigger update_blueprints_updated_at
  before update on blueprints for each row execute function update_updated_at();
create trigger update_awarded_points_updated_at
  before update on awarded_points for each row execute function update_updated_at();
