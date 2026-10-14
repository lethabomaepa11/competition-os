-- Store configurable public pages as JSON to preserve legacy competition content and URLs.
alter table competitions add column if not exists pages jsonb not null default '[]'::jsonb;
