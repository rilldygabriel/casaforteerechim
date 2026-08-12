-- Vínculos de discipulado e histórico pastoral com acesso restrito ao
-- discipulador responsável e aos administradores da Casa.

create table if not exists public.discipleship_relationships (
  id uuid primary key default gen_random_uuid(),
  discipler_id uuid not null references public.discipler_roles(member_id) on delete cascade,
  disciple_id uuid not null unique references public.member_profiles(user_id) on delete cascade,
  assigned_by uuid not null references public.member_profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint discipleship_relationships_distinct_people_check
    check (discipler_id <> disciple_id)
);

create table if not exists public.discipleship_sessions (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.discipleship_relationships(id) on delete cascade,
  meeting_date date not null,
  main_demands text,
  notes text,
  created_by uuid not null references public.member_profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discipleship_sessions_meeting_date_check
    check (meeting_date <= current_date),
  constraint discipleship_sessions_main_demands_check
    check (main_demands is null or length(btrim(main_demands)) between 2 and 4000),
  constraint discipleship_sessions_notes_check
    check (notes is null or length(btrim(notes)) between 2 and 8000),
  constraint discipleship_sessions_content_check
    check (nullif(btrim(main_demands), '') is not null or nullif(btrim(notes), '') is not null)
);

create index if not exists discipleship_relationships_discipler_id_idx
  on public.discipleship_relationships (discipler_id);
create index if not exists discipleship_sessions_relationship_date_idx
  on public.discipleship_sessions (relationship_id, meeting_date desc, created_at desc);
create index if not exists discipleship_sessions_created_by_idx
  on public.discipleship_sessions (created_by);

alter table public.discipleship_relationships enable row level security;
alter table public.discipleship_sessions enable row level security;

create policy discipleship_relationships_read
  on public.discipleship_relationships for select to authenticated
  using (
    discipler_id = (select auth.uid())
    or (select public.is_admin())
  );

create policy discipleship_relationships_admin_insert
  on public.discipleship_relationships for insert to authenticated
  with check ((select public.is_admin()));

create policy discipleship_relationships_admin_delete
  on public.discipleship_relationships for delete to authenticated
  using ((select public.is_admin()));

create policy discipleship_sessions_read
  on public.discipleship_sessions for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.discipleship_relationships
      where discipleship_relationships.id = discipleship_sessions.relationship_id
        and discipleship_relationships.discipler_id = (select auth.uid())
    )
  );

create policy discipleship_sessions_insert
  on public.discipleship_sessions for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (select public.is_admin())
      or exists (
        select 1
        from public.discipleship_relationships
        where discipleship_relationships.id = discipleship_sessions.relationship_id
          and discipleship_relationships.discipler_id = (select auth.uid())
      )
    )
  );

create policy discipleship_sessions_update
  on public.discipleship_sessions for update to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()))
  with check (created_by = (select auth.uid()) or (select public.is_admin()));

create policy discipleship_sessions_delete
  on public.discipleship_sessions for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()));

revoke all on public.discipleship_relationships from anon, authenticated;
revoke all on public.discipleship_sessions from anon, authenticated;
grant select, insert, delete on public.discipleship_relationships to authenticated;
grant select, insert, update, delete on public.discipleship_sessions to authenticated;

comment on table public.discipleship_relationships is
  'Discípulo confiado a um único discipulador; visível somente ao responsável e aos administradores.';
comment on table public.discipleship_sessions is
  'Histórico pastoral privado dos encontros de discipulado, demandas e observações.';
