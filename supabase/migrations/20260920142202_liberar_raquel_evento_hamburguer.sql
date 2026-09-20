create table if not exists public.event_admin_members (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.member_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_admin_members_user_idx
  on public.event_admin_members (user_id, event_id);

alter table public.event_admin_members enable row level security;

revoke all on public.event_admin_members from anon, authenticated;
grant select, insert, update, delete on public.event_admin_members to service_role;

comment on table public.event_admin_members is
  'Permissoes administrativas limitadas a eventos especificos.';

insert into public.event_admin_members (event_id, user_id)
select event.id, profile.user_id
from public.events event
join public.member_profiles profile
  on lower(profile.email) = 'raquelcarla36@gmail.com'
where event.slug = 'hamburguer-da-casa-20-09'
  and event.archived_at is null
  and profile.approval_status = 'approved'
on conflict (event_id, user_id) do nothing;
