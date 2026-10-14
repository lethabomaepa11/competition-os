-- Guest predictions are additive: existing authenticated rows and profiles remain intact.
alter table bets alter column better_id drop not null;
alter table bets add column if not exists guest_token_hash text;

alter table bets add constraint bets_guest_identity_check
  check (better_id is not null or (guest_token_hash is not null and length(btrim(better_name)) between 2 and 48 and points_wagered = 0));

create unique index bets_one_guest_prediction_per_match
  on bets (match_id, guest_token_hash)
  where guest_token_hash is not null;
