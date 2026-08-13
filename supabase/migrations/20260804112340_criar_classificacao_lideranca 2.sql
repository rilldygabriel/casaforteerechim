-- Classificação de discipuladores, líderes e participantes de ministérios.
-- O login continua sendo o mesmo da Área da Família; as permissões são
-- concedidas pelos vínculos abaixo e protegidas por RLS.

create table if not exists public.ministries (
  key text primary key,
  name text not null,
  sort_order smallint not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ministries_key_check check (key ~ '^[a-z0-9_]+$'),
  constraint ministries_name_check check (length(btrim(name)) between 2 and 100),
  constraint ministries_sort_order_check check (sort_order > 0)
);

create table if not exists public.discipler_roles (
  member_id uuid primary key references public.member_profiles(user_id) on delete cascade,
  assigned_by uuid not null references public.member_profiles(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.ministry_leaders (
  ministry_key text not null references public.ministries(key) on delete cascade,
  member_id uuid not null references public.member_profiles(user_id) on delete cascade,
  assigned_by uuid not null references public.member_profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (ministry_key, member_id)
);

create table if not exists public.ministry_members (
  ministry_key text not null references public.ministries(key) on delete cascade,
  member_id uuid not null references public.member_profiles(user_id) on delete cascade,
  assigned_by uuid not null references public.member_profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (ministry_key, member_id)
);

create index if not exists discipler_roles_assigned_by_idx
  on public.discipler_roles (assigned_by);
create index if not exists ministry_leaders_member_id_idx
  on public.ministry_leaders (member_id);
create index if not exists ministry_leaders_assigned_by_idx
  on public.ministry_leaders (assigned_by);
create index if not exists ministry_members_member_id_idx
  on public.ministry_members (member_id);
create index if not exists ministry_members_assigned_by_idx
  on public.ministry_members (assigned_by);

insert into public.ministries (key, name, sort_order)
values
  ('louvor', 'Louvor', 1),
  ('connect_recepcao', 'Connect — Recepção', 2),
  ('connect_consolidacao', 'Connect — Consolidação', 3),
  ('casa_kids', 'Casa Kids', 4),
  ('midias_fotos', 'Mídias — Fotos', 5),
  ('midias_stories', 'Mídias — Stories', 6),
  ('midias_transmissao', 'Mídias — Transmissão', 7),
  ('projecao', 'Projeção', 8),
  ('intercessao', 'Intercessão', 9),
  ('cozinha', 'Cozinha', 10),
  ('cafe', 'Café', 11),
  ('mesa_de_som', 'Mesa de Som', 12)
on conflict (key) do update
set name = excluded.name, sort_order = excluded.sort_order, active = true;

alter table public.ministries enable row level security;
alter table public.discipler_roles enable row level security;
alter table public.ministry_leaders enable row level security;
alter table public.ministry_members enable row level security;

drop policy if exists ministries_approved_read on public.ministries;
create policy ministries_approved_read
  on public.ministries for select to authenticated
  using (
    exists (
      select 1 from public.member_profiles
      where member_profiles.user_id = (select auth.uid())
        and (
          member_profiles.approval_status = 'approved'
          or member_profiles.is_admin = true
        )
    )
  );

drop policy if exists discipler_roles_read on public.discipler_roles;
create policy discipler_roles_read
  on public.discipler_roles for select to authenticated
  using (
    member_id = (select auth.uid())
    or (select public.is_admin())
  );

drop policy if exists discipler_roles_admin_insert on public.discipler_roles;
create policy discipler_roles_admin_insert
  on public.discipler_roles for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists discipler_roles_admin_delete on public.discipler_roles;
create policy discipler_roles_admin_delete
  on public.discipler_roles for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists ministry_leaders_read on public.ministry_leaders;
create policy ministry_leaders_read
  on public.ministry_leaders for select to authenticated
  using (
    member_id = (select auth.uid())
    or (select public.is_admin())
  );

drop policy if exists ministry_leaders_admin_insert on public.ministry_leaders;
create policy ministry_leaders_admin_insert
  on public.ministry_leaders for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists ministry_leaders_admin_delete on public.ministry_leaders;
create policy ministry_leaders_admin_delete
  on public.ministry_leaders for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists ministry_members_read on public.ministry_members;
create policy ministry_members_read
  on public.ministry_members for select to authenticated
  using (
    member_id = (select auth.uid())
    or (select public.is_admin())
    or ministry_key in (
      select ministry_leaders.ministry_key
      from public.ministry_leaders
      where ministry_leaders.member_id = (select auth.uid())
    )
  );

drop policy if exists ministry_members_admin_insert on public.ministry_members;
create policy ministry_members_admin_insert
  on public.ministry_members for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists ministry_members_admin_delete on public.ministry_members;
create policy ministry_members_admin_delete
  on public.ministry_members for delete to authenticated
  using ((select public.is_admin()));

revoke all on public.ministries from anon, authenticated;
revoke all on public.discipler_roles from anon, authenticated;
revoke all on public.ministry_leaders from anon, authenticated;
revoke all on public.ministry_members from anon, authenticated;

grant select on public.ministries to authenticated;
grant select, insert, delete on public.discipler_roles to authenticated;
grant select, insert, delete on public.ministry_leaders to authenticated;
grant select, insert, delete on public.ministry_members to authenticated;

comment on table public.discipler_roles is
  'Pessoas aptas a acessar a futura área de discipulado, sem misturar a função com ministérios.';
comment on table public.ministry_leaders is
  'Líderes com acesso restrito ao painel do respectivo ministério.';
comment on table public.ministry_members is
  'Participantes vinculados a cada ministério da Casa Forte.';
