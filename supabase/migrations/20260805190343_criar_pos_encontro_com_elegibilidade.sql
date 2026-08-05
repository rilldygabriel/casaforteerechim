alter table public.event_registrations
  add column completed_encounter boolean;

alter table public.event_registrations
  drop constraint event_registrations_status_check;

alter table public.event_registrations
  add constraint event_registrations_status_check
  check (status in ('pending', 'contacting', 'confirmed', 'withdrew', 'baptized', 'cancelled', 'rejected'));

insert into public.events (
  title, slug, description, category, start_date, start_time, end_time, location,
  status, registration_enabled, registration_status, is_public, is_featured
) values (
  'Pós-Encontro',
  'pos-encontro-agosto-2026',
  'Um tempo de continuidade para quem participou do Encontro com Deus na Casa. A inscrição é exclusiva para quem já fez o Encontro com Deus na Igreja Casa Forte.',
  'Encontros',
  '2026-08-15',
  '16:00',
  '21:00',
  'Igreja Casa Forte Erechim',
  'confirmed',
  true,
  'open',
  true,
  true
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  start_date = excluded.start_date,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  location = excluded.location,
  status = excluded.status,
  registration_enabled = excluded.registration_enabled,
  registration_status = excluded.registration_status,
  is_public = excluded.is_public,
  is_featured = excluded.is_featured,
  archived_at = null,
  updated_at = now();
