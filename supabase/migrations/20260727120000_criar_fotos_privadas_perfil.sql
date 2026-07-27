-- Fotos privadas dos membros da Área da Família.
-- Cada arquivo fica em uma pasta com o UUID do próprio membro.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'member-profile-photos',
  'member-profile-photos',
  false,
  1048576,
  array['image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists member_profile_photos_select_own
  on storage.objects;

create policy member_profile_photos_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'member-profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists member_profile_photos_insert_own
  on storage.objects;

create policy member_profile_photos_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'member-profile-photos'
    and name ~ (
      '^'
      || (select auth.uid())::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'member_profiles_photo_url_check'
      and conrelid = 'public.member_profiles'::regclass
  ) then
    alter table public.member_profiles
      add constraint member_profiles_photo_url_check
      check (
        photo_url is null
        or photo_url ~ (
          '^'
          || user_id::text
          || '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
        )
      );
  end if;
end
$$;

grant update (photo_url)
  on public.member_profiles
  to authenticated;

comment on column public.member_profiles.photo_url is
  'Caminho privado no bucket member-profile-photos, sempre dentro da pasta do próprio user_id.';
