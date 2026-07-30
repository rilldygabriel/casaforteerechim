alter table public.culto_checkins
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.culto_checkins
  alter column telefone drop not null;

alter table public.culto_checkins
  drop constraint if exists culto_checkins_evento_telefone_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'culto_checkins_evento_membro_key'
      and conrelid = 'public.culto_checkins'::regclass
  ) then
    alter table public.culto_checkins
      add constraint culto_checkins_evento_membro_key
      unique (event_key, event_date, user_id);
  end if;
end
$$;

create index if not exists culto_checkins_user_id_idx
  on public.culto_checkins (user_id)
  where user_id is not null;

drop policy if exists "Publico registra pre check-in futuro"
  on public.culto_checkins;

revoke insert on table public.culto_checkins from anon;
revoke usage, select on sequence public.culto_checkins_id_seq from anon;

grant select, insert, update on table public.culto_checkins to authenticated;
grant usage, select on sequence public.culto_checkins_id_seq to authenticated;

drop policy if exists "Membro consulta o proprio pre check-in"
  on public.culto_checkins;

create policy "Membro consulta o proprio pre check-in"
  on public.culto_checkins
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.member_profiles
      where member_profiles.user_id = (select auth.uid())
        and member_profiles.approval_status = 'approved'
    )
  );

drop policy if exists "Membro registra o proprio pre check-in"
  on public.culto_checkins;

create policy "Membro registra o proprio pre check-in"
  on public.culto_checkins
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and event_key = 'domingo-casa'
    and event_title = 'Culto Domingo na Casa'
    and event_date between current_date and (current_date + 14)
    and exists (
      select 1
      from public.member_profiles
      where member_profiles.user_id = (select auth.uid())
        and member_profiles.approval_status = 'approved'
        and btrim(member_profiles.full_name) = btrim(culto_checkins.nome)
        and (
          culto_checkins.telefone is null
          or regexp_replace(member_profiles.phone, '[^0-9]', '', 'g')
            = culto_checkins.telefone
        )
    )
  );

drop policy if exists "Membro altera o proprio pre check-in"
  on public.culto_checkins;

create policy "Membro altera o proprio pre check-in"
  on public.culto_checkins
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.member_profiles
      where member_profiles.user_id = (select auth.uid())
        and member_profiles.approval_status = 'approved'
    )
  )
  with check (
    user_id = (select auth.uid())
    and event_key = 'domingo-casa'
    and event_title = 'Culto Domingo na Casa'
    and event_date between current_date and (current_date + 14)
    and exists (
      select 1
      from public.member_profiles
      where member_profiles.user_id = (select auth.uid())
        and member_profiles.approval_status = 'approved'
        and btrim(member_profiles.full_name) = btrim(culto_checkins.nome)
        and (
          culto_checkins.telefone is null
          or regexp_replace(member_profiles.phone, '[^0-9]', '', 'g')
            = culto_checkins.telefone
        )
    )
  );
