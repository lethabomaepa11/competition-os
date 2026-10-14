-- Restrict match commentary writes to organization officials while preserving public reads.
-- Existing comment rows are untouched; rollback can disable RLS and remove these policies.
alter table public.match_comments enable row level security;

drop policy if exists "match comments public read" on public.match_comments;
create policy "match comments public read"
  on public.match_comments for select
  using (true);

drop policy if exists "match comments officials insert" on public.match_comments;
create policy "match comments officials insert"
  on public.match_comments for insert
  with check (
    exists (
      select 1
      from public.matches m
      join public.events e on e.id = m.event_id
      join public.competitions c on c.id = e.competition_id
      join public.organization_members om on om.organization_id = c.organization_id
      where m.id = match_comments.match_id
        and om.member_id = auth.uid()
        and om.role in ('owner', 'admin', 'moderator', 'referee')
    )
  );
