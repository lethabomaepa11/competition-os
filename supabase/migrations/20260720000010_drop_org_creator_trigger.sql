-- Remove the auto-add-creator trigger; the route handler now handles this explicitly.

drop trigger if exists after_organization_insert on public.organizations;
drop function if exists public.add_creator_as_owner;
