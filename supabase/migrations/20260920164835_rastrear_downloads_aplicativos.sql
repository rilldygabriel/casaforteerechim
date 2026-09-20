create table public.app_download_events (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  device_token uuid not null,
  source text not null default 'home_header',
  user_agent text,
  first_clicked_at timestamptz not null default now(),
  last_clicked_at timestamptz not null default now(),
  constraint app_download_events_platform_check
    check (platform in ('ios', 'android')),
  constraint app_download_events_source_length_check
    check (length(source) between 1 and 80),
  constraint app_download_events_user_agent_length_check
    check (user_agent is null or length(user_agent) <= 500),
  constraint app_download_events_device_platform_key
    unique (device_token, platform)
);

comment on table public.app_download_events is
  'Dispositivos unicos que iniciaram o download dos aplicativos pelos links oficiais do site.';

comment on column public.app_download_events.device_token is
  'Identificador aleatorio e anonimo salvo em cookie HTTP; nao contem dados pessoais do aparelho.';

create index app_download_events_platform_last_clicked_idx
  on public.app_download_events (platform, last_clicked_at desc);

alter table public.app_download_events enable row level security;

revoke all on table public.app_download_events from anon, authenticated;
