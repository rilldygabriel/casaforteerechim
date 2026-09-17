alter table public.member_profiles
  add column if not exists can_manage_events boolean not null default false;

create index if not exists member_profiles_events_access_idx
  on public.member_profiles (user_id)
  where can_manage_events = true;

comment on column public.member_profiles.can_manage_events is
  'Permite acessar e operar somente o módulo de eventos e inscrições, sem conceder administração geral.';
