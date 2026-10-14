-- Shared rate limits for guest predictions. Identity values are one-way hashes; raw IPs and browser tokens are never stored.
create table if not exists guest_prediction_rate_events (
  id bigint generated always as identity primary key,
  token_hash text not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint guest_prediction_rate_token_hash check (length(token_hash) = 64),
  constraint guest_prediction_rate_ip_hash check (ip_hash is null or length(ip_hash) = 64)
);

create index if not exists guest_prediction_rate_token_time
  on guest_prediction_rate_events (token_hash, created_at desc);
create index if not exists guest_prediction_rate_ip_time
  on guest_prediction_rate_events (ip_hash, created_at desc)
  where ip_hash is not null;
create index if not exists guest_prediction_rate_created_at
  on guest_prediction_rate_events (created_at);

alter table guest_prediction_rate_events enable row level security;
revoke all on guest_prediction_rate_events from anon, authenticated;

create or replace function consume_guest_prediction_rate_limit(p_token_hash text, p_ip_hash text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  token_attempts integer;
  ip_attempts integer;
begin
  if p_token_hash is null or length(p_token_hash) <> 64 or (p_ip_hash is not null and length(p_ip_hash) <> 64) then
    return false;
  end if;

  -- Serializes requests from the same browser across all application instances.
  perform pg_advisory_xact_lock(hashtextextended('guest-prediction:' || p_token_hash, 0));
  delete from guest_prediction_rate_events where created_at < now() - interval '24 hours';

  select count(*) into token_attempts
  from guest_prediction_rate_events
  where token_hash = p_token_hash and created_at > now() - interval '1 hour';
  if token_attempts >= 20 then return false; end if;

  if p_ip_hash is not null then
    select count(*) into ip_attempts
    from guest_prediction_rate_events
    where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
    if ip_attempts >= 60 then return false; end if;
  end if;

  insert into guest_prediction_rate_events (token_hash, ip_hash) values (p_token_hash, p_ip_hash);
  return true;
end;
$$;

revoke all on function consume_guest_prediction_rate_limit(text, text) from public;
grant execute on function consume_guest_prediction_rate_limit(text, text) to anon, authenticated;

-- Rollback: drop function consume_guest_prediction_rate_limit(text, text); drop table guest_prediction_rate_events;
