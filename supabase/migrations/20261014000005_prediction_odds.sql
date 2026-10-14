-- Snapshot the fair event-form price at prediction time; existing predictions stay valid.
alter table bets add column if not exists decimal_odds numeric(6, 2);

alter table bets
  add constraint bets_decimal_odds_check
  check (decimal_odds is null or decimal_odds >= 1.01);
