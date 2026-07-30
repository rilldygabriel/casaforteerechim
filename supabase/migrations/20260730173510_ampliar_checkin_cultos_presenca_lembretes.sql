alter table public.culto_checkins
  drop constraint if exists culto_checkins_event_key_check,
  drop constraint if exists culto_checkins_event_title_check;

alter table public.culto_checkins
  add constraint culto_checkins_event_key_check
    check (event_key in ('domingo-casa', 'quarta-ensino')),
  add constraint culto_checkins_event_title_check
    check (
      (event_key = 'domingo-casa' and event_title = 'Culto Domingo na Casa')
      or
      (event_key = 'quarta-ensino' and event_title = 'Culto Quarta de Ensino')
    ),
  add column if not exists presenca_status text not null default 'pendente',
  add column if not exists presenca_registrada_em timestamptz,
  add column if not exists lembrete_enviado_em timestamptz;

alter table public.culto_checkins
  drop constraint if exists culto_checkins_presenca_status_check;

alter table public.culto_checkins
  add constraint culto_checkins_presenca_status_check
    check (presenca_status in ('pendente', 'presente', 'ausente'));

create index if not exists culto_checkins_lembretes_pendentes_idx
  on public.culto_checkins (event_date, event_key)
  where resposta = 'presencial' and lembrete_enviado_em is null;

drop policy if exists "Membro registra o proprio pre check-in"
  on public.culto_checkins;

create policy "Membro registra o proprio pre check-in"
  on public.culto_checkins
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and event_key in ('domingo-casa', 'quarta-ensino')
    and (
      (event_key = 'domingo-casa' and event_title = 'Culto Domingo na Casa')
      or
      (event_key = 'quarta-ensino' and event_title = 'Culto Quarta de Ensino')
    )
    and event_date between current_date and (current_date + 14)
    and presenca_status = 'pendente'
    and presenca_registrada_em is null
    and lembrete_enviado_em is null
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
    and event_key in ('domingo-casa', 'quarta-ensino')
    and (
      (event_key = 'domingo-casa' and event_title = 'Culto Domingo na Casa')
      or
      (event_key = 'quarta-ensino' and event_title = 'Culto Quarta de Ensino')
    )
    and event_date between current_date and (current_date + 14)
    and presenca_status = 'pendente'
    and presenca_registrada_em is null
    and lembrete_enviado_em is null
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

create policy "Administrador registra presenca no culto"
  on public.culto_checkins
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.member_profiles
      where member_profiles.user_id = (select auth.uid())
        and member_profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.member_profiles
      where member_profiles.user_id = (select auth.uid())
        and member_profiles.is_admin = true
    )
  );
