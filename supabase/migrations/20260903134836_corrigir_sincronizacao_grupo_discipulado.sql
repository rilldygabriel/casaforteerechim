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

create or replace function public.sync_disciple_member_group()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_disciple_id uuid;
begin
  if tg_op <> 'DELETE' and new.ended_at is null then
    insert into public.member_group_memberships (member_id, group_key, assigned_by, assigned_at)
    values (new.disciple_id, 'sendo_discipulado', new.assigned_by, new.created_at)
    on conflict (member_id, group_key) do nothing;
    return null;
  end if;

  v_disciple_id := case when tg_op = 'DELETE' then old.disciple_id else new.disciple_id end;
  if not exists (
    select 1 from public.discipleship_relationships relationship
    where relationship.disciple_id = v_disciple_id
      and relationship.ended_at is null
  ) then
    delete from public.member_group_memberships
    where member_id = v_disciple_id and group_key = 'sendo_discipulado';
  end if;
  return null;
end;
$$;

drop trigger sync_disciple_member_group on public.discipleship_relationships;
create trigger sync_disciple_member_group
after insert or update of ended_at or delete on public.discipleship_relationships
for each row execute function public.sync_disciple_member_group();
