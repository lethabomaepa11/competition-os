-- Grant table privileges to roles
-- The authenticated role needs CRUD on all tables (RLS policies enforce row-level checks)
-- The anon role needs SELECT on publicly-visible tables

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

-- Ensure future tables also get these grants
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
