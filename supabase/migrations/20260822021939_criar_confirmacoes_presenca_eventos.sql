create table public.event_attendance_confirmations (
  id uuid primary key default gen_random_uuid(),
  event_key text not null check (char_length(event_key) between 1 and 160),
  event_title text not null check (char_length(event_title) between 1 and 240),
  event_date date not null,
  event_time time without time zone,
  user_id uuid not null references public.member_profiles(user_id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_key, user_id)
);

create index event_attendance_confirmations_event_date_idx
  on public.event_attendance_confirmations (event_date desc, event_key)
  where status = 'confirmed';

create index event_attendance_confirmations_user_date_idx
  on public.event_attendance_confirmations (user_id, event_date desc);

alter table public.event_attendance_confirmations enable row level security;

revoke all on table public.event_attendance_confirmations from anon;
grant select, insert, update on table public.event_attendance_confirmations to authenticated;

create policy "Membros consultam as próprias confirmações"
  on public.event_attendance_confirmations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Membros criam as próprias confirmações"
  on public.event_attendance_confirmations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Membros atualizam as próprias confirmações"
  on public.event_attendance_confirmations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
