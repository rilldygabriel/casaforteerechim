-- Permite que a administração escolha quais discipuladores aparecem para os
-- membros e preserva o histórico quando um vínculo é encerrado.

alter table public.discipler_roles
  add column if not exists available_for_member_choice boolean not null default false;

alter table public.discipleship_relationships
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by uuid references public.member_profiles(user_id) on delete restrict,
  add column if not exists end_reason text,
  add constraint discipleship_relationships_end_state_check check (
    (ended_at is null and ended_by is null and end_reason is null)
    or
    (ended_at is not null and ended_by is not null and end_reason in ('released_by_discipler', 'released_by_admin'))
  );

alter table public.discipleship_relationships
  drop constraint if exists discipleship_relationships_disciple_id_key;

create unique index if not exists discipleship_relationships_active_disciple_idx
  on public.discipleship_relationships (disciple_id)
  where ended_at is null;

create index if not exists discipleship_relationships_active_discipler_idx
  on public.discipleship_relationships (discipler_id, created_at)
  where ended_at is null;

drop policy if exists discipler_roles_admin_update on public.discipler_roles;
create policy discipler_roles_admin_update
  on public.discipler_roles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant update on public.discipler_roles to authenticated;

comment on column public.discipler_roles.available_for_member_choice is
  'Controla quais discipuladores são exibidos no card de escolha da Área da Família.';
comment on column public.discipleship_relationships.ended_at is
  'Encerramento do vínculo sem apagar o histórico pastoral do discipulado.';
