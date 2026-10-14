-- Add optional public-page theme colors without changing existing records.
alter table competitions add column if not exists theme_color text;
alter table events add column if not exists theme_color text;

alter table competitions
  add constraint competitions_theme_color_hex_check
  check (theme_color is null or theme_color ~ '^#[0-9A-Fa-f]{6}$');

alter table events
  add constraint events_theme_color_hex_check
  check (theme_color is null or theme_color ~ '^#[0-9A-Fa-f]{6}$');

create policy "Organization owners and admins can delete"
  on organizations for delete using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organizations.id
        and om.member_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );
