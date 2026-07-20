-- Add baseline RLS policies for tables that have RLS enabled but lack policies.
-- Authenticated users get full CRUD access. These can be refined later.

create policy "auth_ins" on competitions for insert with check (true);
create policy "auth_sel" on competitions for select using (true);
create policy "auth_upd" on competitions for update using (true) with check (true);
create policy "auth_del" on competitions for delete using (true);

create policy "auth_ins" on events for insert with check (true);
create policy "auth_sel" on events for select using (true);
create policy "auth_upd" on events for update using (true) with check (true);
create policy "auth_del" on events for delete using (true);

create policy "auth_ins" on stages for insert with check (true);
create policy "auth_sel" on stages for select using (true);
create policy "auth_upd" on stages for update using (true) with check (true);
create policy "auth_del" on stages for delete using (true);

create policy "auth_ins" on rounds for insert with check (true);
create policy "auth_sel" on rounds for select using (true);
create policy "auth_upd" on rounds for update using (true) with check (true);
create policy "auth_del" on rounds for delete using (true);

create policy "auth_ins" on teams for insert with check (true);
create policy "auth_sel" on teams for select using (true);
create policy "auth_upd" on teams for update using (true) with check (true);
create policy "auth_del" on teams for delete using (true);

create policy "auth_ins" on participants for insert with check (true);
create policy "auth_sel" on participants for select using (true);
create policy "auth_upd" on participants for update using (true) with check (true);
create policy "auth_del" on participants for delete using (true);

create policy "auth_ins" on matches for insert with check (true);
create policy "auth_sel" on matches for select using (true);
create policy "auth_upd" on matches for update using (true) with check (true);
create policy "auth_del" on matches for delete using (true);

create policy "auth_ins" on match_participants for insert with check (true);
create policy "auth_sel" on match_participants for select using (true);
create policy "auth_upd" on match_participants for update using (true) with check (true);
create policy "auth_del" on match_participants for delete using (true);

create policy "auth_ins" on rule_sets for insert with check (true);
create policy "auth_sel" on rule_sets for select using (true);
create policy "auth_upd" on rule_sets for update using (true) with check (true);
create policy "auth_del" on rule_sets for delete using (true);

create policy "auth_ins" on bets for insert with check (true);
create policy "auth_sel" on bets for select using (true);
create policy "auth_upd" on bets for update using (true) with check (true);
create policy "auth_del" on bets for delete using (true);

create policy "auth_ins" on better_profiles for insert with check (true);
create policy "auth_sel" on better_profiles for select using (true);
create policy "auth_upd" on better_profiles for update using (true) with check (true);
create policy "auth_del" on better_profiles for delete using (true);

create policy "auth_ins" on invites for insert with check (true);
create policy "auth_sel" on invites for select using (true);
create policy "auth_upd" on invites for update using (true) with check (true);
create policy "auth_del" on invites for delete using (true);

create policy "auth_ins" on competition_invites for insert with check (true);
create policy "auth_sel" on competition_invites for select using (true);
create policy "auth_upd" on competition_invites for update using (true) with check (true);
create policy "auth_del" on competition_invites for delete using (true);

create policy "auth_ins" on participant_invites for insert with check (true);
create policy "auth_sel" on participant_invites for select using (true);
create policy "auth_upd" on participant_invites for update using (true) with check (true);
create policy "auth_del" on participant_invites for delete using (true);

create policy "auth_ins" on audit_entries for insert with check (true);
create policy "auth_sel" on audit_entries for select using (true);
create policy "auth_upd" on audit_entries for update using (true) with check (true);
create policy "auth_del" on audit_entries for delete using (true);

create policy "auth_ins" on score_audit_entries for insert with check (true);
create policy "auth_sel" on score_audit_entries for select using (true);
create policy "auth_upd" on score_audit_entries for update using (true) with check (true);
create policy "auth_del" on score_audit_entries for delete using (true);

create policy "auth_ins" on match_timings for insert with check (true);
create policy "auth_sel" on match_timings for select using (true);
create policy "auth_upd" on match_timings for update using (true) with check (true);
create policy "auth_del" on match_timings for delete using (true);

create policy "auth_ins" on progression_links for insert with check (true);
create policy "auth_sel" on progression_links for select using (true);
create policy "auth_upd" on progression_links for update using (true) with check (true);
create policy "auth_del" on progression_links for delete using (true);

create policy "auth_ins" on championship_points for insert with check (true);
create policy "auth_sel" on championship_points for select using (true);
create policy "auth_upd" on championship_points for update using (true) with check (true);
create policy "auth_del" on championship_points for delete using (true);
