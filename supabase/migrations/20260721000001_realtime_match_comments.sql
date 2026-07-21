-- Enable Realtime on matches table
alter publication supabase_realtime add table matches;

-- Create match_comments table for AI commentary
create table match_comments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

-- Enable Realtime on match_comments too
alter publication supabase_realtime add table match_comments;
