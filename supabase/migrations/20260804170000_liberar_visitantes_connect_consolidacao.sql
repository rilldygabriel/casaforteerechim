alter policy "visitantes_admin_select"
  on public.visitantes
  using (
    (select public.is_admin())
    or (
      exists (
        select 1
        from public.member_profiles
        where member_profiles.user_id = (select auth.uid())
          and member_profiles.approval_status = 'approved'
      )
      and (
        exists (
          select 1
          from public.ministry_members
          where ministry_members.member_id = (select auth.uid())
            and ministry_members.ministry_key = 'connect_consolidacao'
        )
        or exists (
          select 1
          from public.ministry_leaders
          where ministry_leaders.member_id = (select auth.uid())
            and ministry_leaders.ministry_key = 'connect_consolidacao'
        )
      )
    )
  );

alter policy "visitantes_admin_update"
  on public.visitantes
  using (
    (select public.is_admin())
    or (
      exists (
        select 1
        from public.member_profiles
        where member_profiles.user_id = (select auth.uid())
          and member_profiles.approval_status = 'approved'
      )
      and (
        exists (
          select 1
          from public.ministry_members
          where ministry_members.member_id = (select auth.uid())
            and ministry_members.ministry_key = 'connect_consolidacao'
        )
        or exists (
          select 1
          from public.ministry_leaders
          where ministry_leaders.member_id = (select auth.uid())
            and ministry_leaders.ministry_key = 'connect_consolidacao'
        )
      )
    )
  )
  with check (
    (select public.is_admin())
    or (
      exists (
        select 1
        from public.member_profiles
        where member_profiles.user_id = (select auth.uid())
          and member_profiles.approval_status = 'approved'
      )
      and (
        exists (
          select 1
          from public.ministry_members
          where ministry_members.member_id = (select auth.uid())
            and ministry_members.ministry_key = 'connect_consolidacao'
        )
        or exists (
          select 1
          from public.ministry_leaders
          where ministry_leaders.member_id = (select auth.uid())
            and ministry_leaders.ministry_key = 'connect_consolidacao'
        )
      )
    )
  );

comment on table public.visitantes is
  'Cadastros de visitantes, acessíveis pela administração e pela equipe do Connect Consolidação.';
