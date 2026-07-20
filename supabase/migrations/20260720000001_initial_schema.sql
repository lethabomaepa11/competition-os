-- CompetitionOS Initial Schema
-- Core enums
create type competition_status as enum ('draft', 'published', 'in_progress', 'completed', 'archived');
create type event_status as enum ('draft', 'open', 'in_progress', 'completed', 'cancelled');
create type match_status as enum ('scheduled', 'in_progress', 'completed', 'disputed', 'cancelled', 'walkover');
create type participant_type as enum ('individual', 'team');
create type participant_status as enum ('active', 'eliminated', 'dropped_out', 'disqualified');
create type format_type as enum ('league', 'single_elimination', 'double_elimination', 'swiss', 'group_stage', 'ladder', 'championship');
create type bracket_group as enum ('winners', 'losers', 'finals');
create type visibility as enum ('public', 'private', 'hidden');
create type registration_policy as enum ('open', 'invite_only', 'approval_required', 'closed');
create type member_role as enum ('owner', 'admin', 'moderator', 'referee', 'member');
create type invite_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type competition_invite_status as enum ('active', 'disabled');
create type participant_invite_status as enum ('pending', 'accepted', 'revoked');
create type progression_link_status as enum ('pending', 'completed');
create type match_result_type as enum ('win', 'loss', 'draw');

-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;

-- Organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table organizations enable row level security;

-- Organization Members
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  role member_role not null default 'member',
  permissions text[] not null default '{}',
  joined_at timestamptz not null default now(),
  unique(organization_id, member_id)
);
alter table organization_members enable row level security;

-- Competitions
create table competitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  blueprint_id uuid,
  name text not null,
  description text not null default '',
  logo_url text,
  visibility visibility not null default 'public',
  game jsonb,
  date_start timestamptz,
  date_end timestamptz,
  status competition_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table competitions enable row level security;

-- Events
create table events (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  name text not null,
  format format_type not null,
  participant_type participant_type not null default 'individual',
  max_participants int,
  min_participants int,
  status event_status not null default 'draft',
  registration_policy registration_policy not null default 'open',
  config jsonb not null default '{}',
  date_start timestamptz,
  date_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table events enable row level security;

-- Stages
create table stages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  type text not null,
  order_index int not null default 0,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table stages enable row level security;

-- Rounds
create table rounds (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references stages(id) on delete cascade,
  name text not null,
  round_number int not null,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table rounds enable row level security;

-- Teams
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  member_ids uuid[] not null default '{}',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table teams enable row level security;

-- Participants
create table participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  member_id uuid references profiles(id) on delete set null,
  team_id uuid references teams(id) on delete set null,
  display_name text not null,
  seed int,
  status participant_status not null default 'active',
  registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table participants enable row level security;

-- Matches
create table matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  bracket_group bracket_group,
  status match_status not null default 'scheduled',
  winner_id uuid references participants(id) on delete set null,
  scores jsonb,
  is_walkover bool not null default false,
  notes text,
  finalized_by uuid references profiles(id) on delete set null,
  finalized_at timestamptz,
  scheduled_at timestamptz,
  started_at timestamptz,
  venue text,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table matches enable row level security;

-- Match Participants (join table with result info)
create table match_participants (
  match_id uuid not null references matches(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  position int not null,
  result match_result_type,
  score numeric,
  primary key (match_id, participant_id)
);
alter table match_participants enable row level security;

-- Rule Sets
create table rule_sets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  rules jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table rule_sets enable row level security;

-- Bets
create table bets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  better_id uuid not null references profiles(id) on delete cascade,
  better_name text not null,
  points_wagered int not null,
  placed_at timestamptz not null default now(),
  settled bool not null default false,
  won bool not null default false,
  points_awarded int not null default 0
);
alter table bets enable row level security;

-- Better Profiles
create table better_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_points int not null default 0,
  bets_won int not null default 0,
  bets_lost int not null default 0,
  total_wagered int not null default 0,
  net_points int not null default 0
);
alter table better_profiles enable row level security;

-- Invites (organization)
create table invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role member_role not null default 'member',
  token text not null unique,
  status invite_status not null default 'pending',
  invited_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
alter table invites enable row level security;

-- Competition Invites
create table competition_invites (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  token text not null unique,
  status competition_invite_status not null default 'active',
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table competition_invites enable row level security;

-- Participant Invites
create table participant_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  email text not null,
  display_name text not null,
  token text not null unique,
  status participant_invite_status not null default 'pending',
  invited_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
alter table participant_invites enable row level security;

-- Audit Entries
create table audit_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid not null references profiles(id) on delete cascade,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  diff jsonb not null default '{}',
  snapshot jsonb not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table audit_entries enable row level security;

-- Score Audit Entries
create table score_audit_entries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  score numeric not null,
  action_type text not null,
  timestamp timestamptz not null default now(),
  match_elapsed_ms int,
  round_number int,
  stage_name text
);
alter table score_audit_entries enable row level security;

-- Match Timings
create table match_timings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  started_at timestamptz not null,
  finalized_at timestamptz,
  duration_ms int
);
alter table match_timings enable row level security;

-- Progression Links
create table progression_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  source_stage_id uuid not null references stages(id) on delete cascade,
  target_stage_id uuid not null references stages(id) on delete cascade,
  qualifier_count int not null,
  status progression_link_status not null default 'pending',
  created_at timestamptz not null default now()
);
alter table progression_links enable row level security;

-- Championship Points
create table championship_points (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  points numeric not null default 0,
  unique(event_id, participant_id)
);
alter table championship_points enable row level security;

-- Indexes
create index idx_organization_members_member on organization_members(member_id);
create index idx_organization_members_org on organization_members(organization_id);
create index idx_competitions_org on competitions(organization_id);
create index idx_events_competition on events(competition_id);
create index idx_stages_event on stages(event_id);
create index idx_rounds_stage on rounds(stage_id);
create index idx_matches_round on matches(round_id);
create index idx_matches_event on matches(event_id);
create index idx_matches_status on matches(status);
create index idx_match_participants_match on match_participants(match_id);
create index idx_match_participants_participant on match_participants(participant_id);
create index idx_participants_event on participants(event_id);
create index idx_bets_match on bets(match_id);
create index idx_bets_better on bets(better_id);
create index idx_invites_org on invites(organization_id);
create index idx_invites_token on invites(token);
create index idx_audit_entries_org on audit_entries(organization_id);
create index idx_score_audit_match on score_audit_entries(match_id);
create index idx_match_timings_match on match_timings(match_id);
create index idx_progression_links_event on progression_links(event_id);

-- Auto-update updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_organizations_updated_at
  before update on organizations for each row execute function update_updated_at();
create trigger update_competitions_updated_at
  before update on competitions for each row execute function update_updated_at();
create trigger update_events_updated_at
  before update on events for each row execute function update_updated_at();
create trigger update_stages_updated_at
  before update on stages for each row execute function update_updated_at();
create trigger update_rounds_updated_at
  before update on rounds for each row execute function update_updated_at();
create trigger update_matches_updated_at
  before update on matches for each row execute function update_updated_at();
create trigger update_participants_updated_at
  before update on participants for each row execute function update_updated_at();
create trigger update_teams_updated_at
  before update on teams for each row execute function update_updated_at();
create trigger update_rule_sets_updated_at
  before update on rule_sets for each row execute function update_updated_at();
create trigger update_profiles_updated_at
  before update on profiles for each row execute function update_updated_at();

-- Auto-create profile on auth signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- RLS Policies
-- Profiles: users can read/update their own profile
create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Organizations: members can read, admins/owners can update
create policy "Organization members can view"
  on organizations for select using (
    exists (select 1 from organization_members where organization_id = id and member_id = auth.uid())
  );
create policy "Organization admins can update"
  on organizations for update using (
    exists (select 1 from organization_members where organization_id = id and member_id = auth.uid() and role in ('owner', 'admin'))
  );
create policy "Anyone can create organizations"
  on organizations for insert with check (true);

-- Organization Members
create policy "Members can view org members"
  on organization_members for select using (
    exists (select 1 from organization_members om where om.organization_id = organization_id and om.member_id = auth.uid())
  );
create policy "Members can insert self as owner"
  on organization_members for insert with check (
    member_id = auth.uid()
    and not exists (select 1 from organization_members om where om.organization_id = organization_id)
  );
create policy "Admins can manage members"
  on organization_members for insert with check (
    exists (select 1 from organization_members om where om.organization_id = organization_id and om.member_id = auth.uid() and om.role in ('owner', 'admin'))
  );
create policy "Admins can delete members"
  on organization_members for delete using (
    exists (select 1 from organization_members om where om.organization_id = organization_id and om.member_id = auth.uid() and om.role in ('owner', 'admin'))
  );
