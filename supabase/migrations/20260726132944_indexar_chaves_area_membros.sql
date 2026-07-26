-- Índices de apoio para as relações usadas pela aprovação de membros.

create index if not exists member_applications_auth_user_id_idx
  on public.member_applications (auth_user_id)
  where auth_user_id is not null;

create index if not exists member_applications_reviewed_by_idx
  on public.member_applications (reviewed_by)
  where reviewed_by is not null;

create index if not exists member_profiles_approved_by_idx
  on public.member_profiles (approved_by)
  where approved_by is not null;
