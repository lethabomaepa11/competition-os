-- Participant match and bracket emails. Additive: no existing table or policy changes.
-- Each delivered message is logged once so repeated operator actions never email a player twice.
create table if not exists participant_notifications (
  dedupe_key text primary key,
  event_id uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table participant_notifications enable row level security;
revoke all on participant_notifications from anon, authenticated;

create or replace function public.is_event_official(p_event_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from events e
    join competitions c on c.id = e.competition_id
    join organization_members om on om.organization_id = c.organization_id
    where e.id = p_event_id
      and om.member_id = auth.uid()
      and om.role in ('owner', 'admin', 'moderator', 'referee')
  );
$$;

-- Officials may email entrants without being able to read their profiles directly.
create or replace function public.event_participant_contacts(p_event_id uuid)
returns table (participant_id uuid, display_name text, status participant_status, email text)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_event_official(p_event_id) then
    raise exception 'Only event officials can contact participants';
  end if;
  return query
    select p.id, p.display_name, p.status, pr.email
    from participants p
    left join profiles pr on pr.id = p.member_id
    where p.event_id = p_event_id;
end;
$$;

create or replace function public.claim_participant_notification(p_event_id uuid, p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_event_official(p_event_id) then
    raise exception 'Only event officials can notify participants';
  end if;
  insert into participant_notifications (dedupe_key, event_id) values (p_key, p_event_id)
  on conflict (dedupe_key) do nothing;
  return found;
end;
$$;

-- Frees a claim when delivery fails so the next attempt can send it.
create or replace function public.release_participant_notification(p_event_id uuid, p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_event_official(p_event_id) then
    raise exception 'Only event officials can notify participants';
  end if;
  delete from participant_notifications where dedupe_key = p_key and event_id = p_event_id;
end;
$$;

revoke all on function public.is_event_official(uuid) from public, anon;
revoke all on function public.event_participant_contacts(uuid) from public, anon;
revoke all on function public.claim_participant_notification(uuid, text) from public, anon;
revoke all on function public.release_participant_notification(uuid, text) from public, anon;
grant execute on function public.is_event_official(uuid) to authenticated;
grant execute on function public.event_participant_contacts(uuid) to authenticated;
grant execute on function public.claim_participant_notification(uuid, text) to authenticated;
grant execute on function public.release_participant_notification(uuid, text) to authenticated;

-- Rollback: drop the four functions above; drop table participant_notifications;
