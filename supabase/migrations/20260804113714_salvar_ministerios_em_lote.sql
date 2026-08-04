-- Substitui todos os vínculos de uma função em um ministério numa única
-- transação. A função roda com as permissões do usuário e continua sujeita às
-- políticas RLS das tabelas.

create or replace function public.replace_ministry_assignments(
  p_ministry_key text,
  p_role text,
  p_member_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.member_profiles
    where member_profiles.user_id = (select auth.uid())
      and member_profiles.is_admin = true
      and member_profiles.approval_status = 'approved'
  ) then
    raise exception 'Acesso administrativo necessário.';
  end if;

  if p_role not in ('leader', 'member') then
    raise exception 'Função inválida.';
  end if;

  if not exists (
    select 1 from public.ministries
    where ministries.key = p_ministry_key
      and ministries.active = true
  ) then
    raise exception 'Ministério inválido.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_member_ids, '{}'::uuid[])) as selected(member_id)
    left join public.member_profiles
      on member_profiles.user_id = selected.member_id
      and member_profiles.approval_status = 'approved'
    where member_profiles.user_id is null
  ) then
    raise exception 'Um dos membros selecionados não está aprovado.';
  end if;

  if p_role = 'leader' then
    delete from public.ministry_leaders
    where ministry_leaders.ministry_key = p_ministry_key;

    insert into public.ministry_leaders (ministry_key, member_id, assigned_by)
    select p_ministry_key, selected.member_id, (select auth.uid())
    from (
      select distinct member_id
      from unnest(coalesce(p_member_ids, '{}'::uuid[])) as ids(member_id)
    ) as selected;
  else
    delete from public.ministry_members
    where ministry_members.ministry_key = p_ministry_key;

    insert into public.ministry_members (ministry_key, member_id, assigned_by)
    select p_ministry_key, selected.member_id, (select auth.uid())
    from (
      select distinct member_id
      from unnest(coalesce(p_member_ids, '{}'::uuid[])) as ids(member_id)
    ) as selected;
  end if;
end;
$$;

revoke all on function public.replace_ministry_assignments(text, text, uuid[])
  from public, anon, authenticated;
grant execute on function public.replace_ministry_assignments(text, text, uuid[])
  to authenticated;

comment on function public.replace_ministry_assignments(text, text, uuid[]) is
  'Salva líderes ou participantes de um ministério em lote, somente para administradores aprovados.';
