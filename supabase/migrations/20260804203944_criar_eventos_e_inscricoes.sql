create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '' check (char_length(description) <= 3000),
  category text not null check (char_length(category) between 2 and 80),
  start_date date not null,
  end_date date,
  start_time time,
  end_time time,
  location text not null default '' check (char_length(location) <= 240),
  image_url text,
  status text not null default 'confirmed' check (status in ('confirmed', 'tentative', 'cancelled')),
  registration_enabled boolean not null default false,
  registration_status text not null default 'closed' check (registration_status in ('open', 'closed')),
  registration_deadline timestamptz,
  capacity integer check (capacity is null or capacity > 0),
  is_public boolean not null default true,
  is_featured boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  full_name text not null check (char_length(full_name) between 3 and 160),
  phone text not null check (char_length(phone) between 10 and 20),
  phone_normalized text not null check (phone_normalized ~ '^[0-9]{10,13}$'),
  attendance_duration text not null check (attendance_duration in ('not_attending', 'under_1_month', '1_to_3_months', '3_to_6_months', '6_to_12_months', '1_to_2_years', 'over_2_years')),
  notes text not null default '' check (char_length(notes) <= 1500),
  status text not null default 'pending' check (status in ('pending', 'contacting', 'confirmed', 'withdrew', 'baptized', 'cancelled')),
  consent boolean not null check (consent = true),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, phone_normalized)
);

create index events_public_date_idx on public.events (start_date, start_time) where is_public = true and archived_at is null;
create index events_active_idx on public.events (archived_at, start_date);
create index event_registrations_event_created_idx on public.event_registrations (event_id, created_at desc) where archived_at is null;
create index event_registrations_status_idx on public.event_registrations (status, created_at desc) where archived_at is null;
create index event_registrations_name_idx on public.event_registrations (lower(full_name));

alter table public.events enable row level security;
alter table public.event_registrations enable row level security;

revoke all on public.events, public.event_registrations from anon, authenticated;
grant select on public.events to anon, authenticated;
grant all on public.events, public.event_registrations to service_role;

create policy "Eventos publicos podem ser lidos"
on public.events for select to anon, authenticated
using (is_public = true and archived_at is null);

insert into public.events (
  title, slug, description, category, start_date, start_time, location, status,
  registration_enabled, registration_status, is_public, is_featured
) values
  ('Culto de Ceia + Batismo na Casa', 'batismo-setembro-2026', 'Você tomou a decisão de seguir Jesus e deseja dar o próximo passo? Faça sua inscrição para o Batismo na Casa.', 'Batismo', '2026-09-13', '19:00', 'Igreja Casa Forte Erechim', 'confirmed', true, 'open', true, true),
  ('Culto de Ceia + Batismo na Casa', 'batismo-dezembro-2026', 'Você tomou a decisão de seguir Jesus e deseja dar o próximo passo? Faça sua inscrição para o Batismo na Casa.', 'Batismo', '2026-12-13', '19:00', 'Igreja Casa Forte Erechim', 'confirmed', true, 'open', true, true);
