create table public.member_groups (
  key text primary key,
  name text not null,
  description text not null,
  sort_order smallint not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint member_groups_key_check check (key ~ '^[a-z0-9_]+$'),
  constraint member_groups_name_check check (char_length(btrim(name)) between 2 and 80),
  constraint member_groups_description_check check (char_length(btrim(description)) between 2 and 220),
  constraint member_groups_sort_order_check check (sort_order > 0)
);

insert into public.member_groups (key, name, description, sort_order)
values
  ('voluntario', 'Voluntário', 'Pessoa que serve voluntariamente nas atividades da Casa.', 1),
  ('discipulador', 'Discipulador', 'Pessoa autorizada a acompanhar e cuidar de discípulos.', 2),
  ('equipe_pastoral', 'Equipe Pastoral', 'Pessoa que faz parte da equipe de apoio dos pastores.', 3),
  ('sendo_discipulado', 'Sendo Discipulado', 'Pessoa que está em caminhada de discipulado na Casa.', 4);

create table public.member_group_memberships (
  member_id uuid not null references public.member_profiles(user_id) on delete cascade,
  group_key text not null references public.member_groups(key) on delete restrict,
  assigned_by uuid not null references public.member_profiles(user_id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (member_id, group_key)
);

create index member_group_memberships_group_member_idx
  on public.member_group_memberships (group_key, member_id);
create index member_group_memberships_assigned_by_idx
  on public.member_group_memberships (assigned_by);

alter table public.member_groups enable row level security;
alter table public.member_group_memberships enable row level security;

create policy member_groups_approved_read
  on public.member_groups for select to authenticated
  using (
    exists (
      select 1
      from public.member_profiles profile
      where profile.user_id = (select auth.uid())
        and (profile.approval_status = 'approved' or profile.is_admin = true)
    )
  );

create policy member_group_memberships_read
  on public.member_group_memberships for select to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin()));

create policy member_group_memberships_admin_insert
  on public.member_group_memberships for insert to authenticated
  with check ((select public.is_admin()) and assigned_by = (select auth.uid()));

create policy member_group_memberships_admin_update
  on public.member_group_memberships for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()) and assigned_by = (select auth.uid()));

create policy member_group_memberships_admin_delete
  on public.member_group_memberships for delete to authenticated
  using ((select public.is_admin()));

revoke all on public.member_groups, public.member_group_memberships from public, anon, authenticated;
grant select on public.member_groups to authenticated;
grant select, insert, update, delete on public.member_group_memberships to authenticated;
grant all on public.member_groups, public.member_group_memberships to service_role;

insert into public.member_group_memberships (member_id, group_key, assigned_by, assigned_at)
select role.member_id, 'discipulador', role.assigned_by, role.created_at
from public.discipler_roles role
on conflict (member_id, group_key) do nothing;

insert into public.member_group_memberships (member_id, group_key, assigned_by, assigned_at)
select relationship.disciple_id, 'sendo_discipulado', relationship.assigned_by, relationship.created_at
from public.discipleship_relationships relationship
where relationship.ended_at is null
on conflict (member_id, group_key) do nothing;

create function public.set_member_groups(p_member_id uuid, p_group_keys text[])
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

revoke all on function public.set_member_groups(uuid, text[]) from public, anon;
grant execute on function public.set_member_groups(uuid, text[]) to authenticated;

create function public.sync_discipler_member_group()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.member_group_memberships (member_id, group_key, assigned_by, assigned_at)
    values (new.member_id, 'discipulador', new.assigned_by, new.created_at)
    on conflict (member_id, group_key) do nothing;
    return new;
  end if;

  delete from public.member_group_memberships
  where member_id = old.member_id and group_key = 'discipulador';
  return old;
end;
$$;

create trigger sync_discipler_member_group
after insert or delete on public.discipler_roles
for each row execute function public.sync_discipler_member_group();

create function public.sync_disciple_member_group()
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

create trigger sync_disciple_member_group
after insert or update of ended_at or delete on public.discipleship_relationships
for each row execute function public.sync_disciple_member_group();

comment on table public.member_groups is
  'Grupos administrativos usados para classificar os membros da Casa.';
comment on table public.member_group_memberships is
  'Classificacoes dos membros atribuídas pelos administradores da Casa.';
