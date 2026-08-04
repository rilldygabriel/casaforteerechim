-- O aceite usa INSERT ... ON CONFLICT, que também exige UPDATE mesmo quando
-- a pessoa ainda não está no ministério. A RLS continua limitada a admins.
grant update on public.ministry_members to authenticated;

drop policy if exists ministry_members_admin_update
  on public.ministry_members;

create policy ministry_members_admin_update
on public.ministry_members
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
