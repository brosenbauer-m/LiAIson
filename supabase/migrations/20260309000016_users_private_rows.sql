-- Migration: users_private_rows
-- Security fix: the users table had a select policy "using (true)", so anyone with
-- the public (anon) key could read every column of every profile directly from the
-- database, including contact links and settings of Private profiles, bypassing the
-- app's access rules. The app reads other users' profiles only on the server with
-- the service role (which ignores RLS), so this policy is not needed.
-- After this, signed-in users can still read and update only their own row.
-- The live policy name differs from the baseline file, so both names are dropped.

begin;

drop policy if exists "Public profiles are viewable by anyone" on public.users;
drop policy if exists "Public profiles viewable by anyone" on public.users;

commit;
