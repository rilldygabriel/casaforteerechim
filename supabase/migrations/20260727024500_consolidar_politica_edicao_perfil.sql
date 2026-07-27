-- Consolida a administração e a autoedição em uma única política permissiva.
-- Administradores mantêm a gestão de qualquer perfil; membros aprovados
-- continuam limitados ao próprio user_id.

drop policy if exists member_profiles_admin_approval_update
  on public.member_profiles;

drop policy if exists member_profiles_approved_self_update
  on public.member_profiles;

drop policy if exists member_profiles_authenticated_update
  on public.member_profiles;

create policy member_profiles_authenticated_update
  on public.member_profiles
  for update
  to authenticated
  using (
    public.is_admin()
    or (
      user_id = (select auth.uid())
      and (approval_status = 'approved' or is_admin)
    )
  )
  with check (
    public.is_admin()
    or (
      user_id = (select auth.uid())
      and (approval_status = 'approved' or is_admin)
    )
  );
