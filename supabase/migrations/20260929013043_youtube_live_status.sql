-- Server-only cache: visitors never spend the channel's YouTube quota.
create table public.youtube_live_status (
  channel_id text primary key,
  snapshot jsonb not null default '{"status":"unknown","video":null}'::jsonb,
  checked_at timestamptz,
  discovery_at timestamptz,
  search_day text,
  search_count integer not null default 0 check (search_count >= 0),
  lease_until timestamptz not null default '-infinity'
);
alter table public.youtube_live_status enable row level security;
revoke all on public.youtube_live_status from public, anon, authenticated;
grant select, insert, update on public.youtube_live_status to service_role;
insert into public.youtube_live_status (channel_id)
values ('UCKNTxNCEZrPT-EHiU61qA2A');
