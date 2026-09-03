-- Toda pessoa vinculada como participante ou lider de ministerio e voluntaria.
-- A classificacao permanece enquanto existir ao menos um vinculo ministerial.

create function private.sync_ministry_volunteer_group()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if tg_op <> 'DELETE' then
    insert into public.member_group_memberships (
      member_id,
      group_key,
      assigned_by,
      assigned_at
    )
    values (
      new.member_id,
      'voluntario',
      new.assigned_by,
      new.created_at
    )
    on conflict (member_id, group_key) do nothing;
  end if;

  if tg_op = 'UPDATE' and old.member_id <> new.member_id then
    v_member_id := old.member_id;
  elsif tg_op = 'DELETE' then
    v_member_id := old.member_id;
  else
    return new;
  end if;

  if not exists (
    select 1
    from public.ministry_members
    where ministry_members.member_id = v_member_id
  ) and not exists (
    select 1
    from public.ministry_leaders
    where ministry_leaders.member_id = v_member_id
  ) then
    delete from public.member_group_memberships
    where member_id = v_member_id
      and group_key = 'voluntario';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_ministry_volunteer_group() from public, anon, authenticated;

create trigger sync_ministry_member_volunteer_group
after insert or update of member_id or delete on public.ministry_members
for each row execute function private.sync_ministry_volunteer_group();

create trigger sync_ministry_leader_volunteer_group
after insert or update of member_id or delete on public.ministry_leaders
for each row execute function private.sync_ministry_volunteer_group();

-- Atualiza os cadastros que ja servem hoje, preservando a primeira atribuicao.
insert into public.member_group_memberships (
  member_id,
  group_key,
  assigned_by,
  assigned_at
)
select distinct on (assignment.member_id)
  assignment.member_id,
  'voluntario',
  assignment.assigned_by,
  assignment.created_at
from (
  select member_id, assigned_by, created_at from public.ministry_members
  union all
  select member_id, assigned_by, created_at from public.ministry_leaders
) assignment
order by assignment.member_id, assignment.created_at, assignment.assigned_by
on conflict (member_id, group_key) do nothing;

-- Mantem a regra tambem quando os grupos sao editados diretamente na ficha.
create or replace function public.set_member_groups(p_member_id uuid, p_group_keys text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_admin_id uuid := (select auth.uid());
  v_group_keys text[];
begin
  if v_admin_id is null or not (select public.is_admin()) then
    raise exception 'acao nao autorizada';
  end if;

  if not exists (select 1 from public.member_profiles where user_id = p_member_id) then
    raise exception 'membro nao encontrado';
  end if;

  select coalesce(array_agg(distinct item order by item), '{}'::text[])
  into v_group_keys
  from unnest(coalesce(p_group_keys, '{}'::text[])) as selected(item)
  where nullif(btrim(item), '') is not null;

  if exists (
    select 1
    from unnest(v_group_keys) as selected(item)
    where not exists (
      select 1 from public.member_groups groups
      where groups.key = selected.item and groups.active = true
    )
  ) then
    raise exception 'grupo invalido';
  end if;

  if exists (
    select 1 from public.ministry_members where member_id = p_member_id
  ) or exists (
    select 1 from public.ministry_leaders where member_id = p_member_id
  ) then
    select coalesce(array_agg(distinct item order by item), '{}'::text[])
    into v_group_keys
    from unnest(v_group_keys || array['voluntario']::text[]) as selected(item);
  end if;

  if not ('discipulador' = any(v_group_keys)) and exists (
    select 1 from public.discipleship_relationships
    where discipler_id = p_member_id and ended_at is null
  ) then
    raise exception 'discipulador possui discipulos vinculados';
  end if;

  if not ('sendo_discipulado' = any(v_group_keys)) and exists (
    select 1 from public.discipleship_relationships
    where disciple_id = p_member_id and ended_at is null
  ) then
    raise exception 'membro possui discipulador vinculado';
  end if;

  delete from public.member_group_memberships membership
  where membership.member_id = p_member_id
    and not (membership.group_key = any(v_group_keys));

  insert into public.member_group_memberships (member_id, group_key, assigned_by)
  select p_member_id, selected.item, v_admin_id
  from unnest(v_group_keys) as selected(item)
  on conflict (member_id, group_key) do update
  set assigned_by = excluded.assigned_by;

  if 'discipulador' = any(v_group_keys) then
    insert into public.discipler_roles (member_id, assigned_by)
    values (p_member_id, v_admin_id)
    on conflict (member_id) do nothing;
  else
    delete from public.discipler_roles where member_id = p_member_id;
  end if;
end;
$$;

comment on function private.sync_ministry_volunteer_group() is
  'Sincroniza automaticamente o grupo Voluntario a partir dos vinculos ministeriais.';
