alter table public.event_registrations
  add column if not exists email text
  check (email is null or char_length(email) <= 254);

insert into public.events (
  title,
  slug,
  description,
  category,
  start_date,
  end_date,
  location,
  status,
  registration_enabled,
  registration_status,
  registration_deadline,
  capacity,
  is_public,
  is_featured,
  registration_fee_cents
)
values
  (
    'Encontro com Deus de Mulheres',
    'encontro-com-deus-mulheres-2026',
    'Um tempo especial de encontro com Deus, cuidado e transformação para as mulheres da Casa.',
    'Encontros',
    '2026-10-16',
    '2026-10-18',
    'Igreja Casa Forte Erechim',
    'confirmed',
    true,
    'open',
    null,
    null,
    true,
    true,
    25000
  ),
  (
    'Encontro com Deus de Homens',
    'encontro-com-deus-homens-2026',
    'Um tempo especial de encontro com Deus, cuidado e transformação para os homens da Casa.',
    'Encontros',
    '2026-10-23',
    '2026-10-25',
    'Igreja Casa Forte Erechim',
    'confirmed',
    true,
    'open',
    null,
    null,
    true,
    true,
    25000
  )
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  location = excluded.location,
  status = excluded.status,
  registration_enabled = excluded.registration_enabled,
  registration_status = excluded.registration_status,
  registration_deadline = excluded.registration_deadline,
  capacity = excluded.capacity,
  is_public = excluded.is_public,
  is_featured = excluded.is_featured,
  registration_fee_cents = excluded.registration_fee_cents,
  archived_at = null,
  updated_at = now();
