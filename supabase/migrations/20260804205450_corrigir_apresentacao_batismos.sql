update public.events
set
  title = 'Batismo nas Águas',
  description = 'Você tomou a decisão de seguir Jesus e deseja dar o próximo passo? Participe do Batismo nas Águas durante o Culto de Ceia na Casa.',
  category = 'Batismo',
  updated_at = now()
where slug in ('batismo-setembro-2026', 'batismo-dezembro-2026');
