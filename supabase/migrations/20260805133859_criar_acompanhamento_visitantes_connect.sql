create table public.visitor_followup_steps (
  id bigint generated always as identity primary key,
  visitor_id bigint not null references public.visitantes(id) on delete cascade,
  step_key text not null check (
    step_key in (
      'monday_message',
      'thursday_message',
      'next_service_invite',
      'following_week_contact'
    )
  ),
  due_date date not null,
  assigned_to uuid references public.member_profiles(user_id) on delete set null,
  assigned_at timestamptz,
  completed_by uuid references public.member_profiles(user_id) on delete set null,
  completed_at timestamptz,
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visitor_id, step_key),
  check (
    (assigned_to is null and assigned_at is null)
    or (assigned_to is not null and assigned_at is not null)
  ),
  check (
    (completed_by is null and completed_at is null)
    or (completed_by is not null and completed_at is not null)
  )
);

create index visitor_followup_steps_pending_due_idx
  on public.visitor_followup_steps (due_date, visitor_id)
  where completed_at is null;

create index visitor_followup_steps_assigned_to_idx
  on public.visitor_followup_steps (assigned_to)
  where assigned_to is not null;

create index visitor_followup_steps_completed_by_idx
  on public.visitor_followup_steps (completed_by)
  where completed_by is not null;

alter table public.visitor_followup_steps enable row level security;

create policy visitor_followup_steps_connect_select
  on public.visitor_followup_steps for select to authenticated
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

create policy visitor_followup_steps_connect_update
  on public.visitor_followup_steps for update to authenticated
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

revoke all on public.visitor_followup_steps from anon, authenticated;
grant select, update on public.visitor_followup_steps to authenticated;

create table public.visitor_followup_alerts (
  id bigint generated always as identity primary key,
  followup_step_id bigint not null references public.visitor_followup_steps(id) on delete cascade,
  alert_date date not null,
  recipients_count integer not null default 0 check (recipients_count >= 0),
  created_at timestamptz not null default now(),
  unique (followup_step_id, alert_date)
);

create index visitor_followup_alerts_date_idx
  on public.visitor_followup_alerts (alert_date desc);

alter table public.visitor_followup_alerts enable row level security;
revoke all on public.visitor_followup_alerts from anon, authenticated;

create policy visitor_followup_alerts_no_direct_access
  on public.visitor_followup_alerts for select to authenticated
  using (false);

insert into public.visitor_followup_steps (visitor_id, step_key, due_date)
select
  visitantes.id,
  steps.step_key,
  case steps.step_key
    when 'monday_message' then visitantes.data_visita
      + ((1 - extract(dow from visitantes.data_visita)::integer + 7) % 7)
    when 'thursday_message' then visitantes.data_visita
      + ((4 - extract(dow from visitantes.data_visita)::integer + 7) % 7)
    when 'next_service_invite' then visitantes.data_visita
      + ((6 - extract(dow from visitantes.data_visita)::integer + 7) % 7)
    when 'following_week_contact' then visitantes.data_visita
      + ((1 - extract(dow from visitantes.data_visita)::integer + 7) % 7) + 7
  end
from public.visitantes
cross join (
  values
    ('monday_message'),
    ('thursday_message'),
    ('next_service_invite'),
    ('following_week_contact')
) as steps(step_key)
on conflict (visitor_id, step_key) do nothing;

comment on table public.visitor_followup_steps is
  'Etapas compartilhadas de acompanhamento dos visitantes pela equipe Connect Consolidação e pastores.';

comment on table public.visitor_followup_alerts is
  'Controle interno para evitar notificações repetidas de etapas de acompanhamento vencidas.';
