-- Allow users to insert their own profile (used as fallback when trigger hasn't created one)
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);
