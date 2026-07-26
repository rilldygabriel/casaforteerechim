-- Base segura da Área de Membros da Igreja Casa Forte.
-- O acesso à área Família depende de aprovação administrativa explícita.

alter table public.member_profiles
  add column if not exists phone text not null default '',
  add column if not exists instagram text not null default '',
  add column if not exists birth_date date,
  add column if not exists jesus_year smallint,
  add column if not exists previous_ministry text not null default '',
  add column if not exists baptized boolean,
  add column if not exists photo_url text,
  add column if not exists ministries text[] not null default '{}'::text[],
  add column if not exists church_status text not null default 'aguardando_aprovacao',
  add column if not exists profile_completed boolean not null default false,
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'member_profiles_approval_status_check'
      and conrelid = 'public.member_profiles'::regclass
  ) then
    alter table public.member_profiles
      add constraint member_profiles_approval_status_check
      check (approval_status in ('pending', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'member_profiles_church_status_check'
      and conrelid = 'public.member_profiles'::regclass
  ) then
    alter table public.member_profiles
      add constraint member_profiles_church_status_check
      check (
        church_status in (
          'aguardando_aprovacao',
          'membro',
          'congregado',
          'afastado',
          'inativo'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'member_profiles_phone_length_check'
      and conrelid = 'public.member_profiles'::regclass
  ) then
    alter table public.member_profiles
      add constraint member_profiles_phone_length_check
      check (length(phone) <= 30);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'member_profiles_jesus_year_check'
      and conrelid = 'public.member_profiles'::regclass
  ) then
    alter table public.member_profiles
      add constraint member_profiles_jesus_year_check
      check (jesus_year is null or jesus_year between 1900 and 2100);
  end if;
end
$$;

update public.member_profiles
set
  approval_status = 'approved',
  church_status = 'membro',
  approved_at = coalesce(approved_at, now()),
  approved_by = coalesce(approved_by, user_id),
  updated_at = now()
where is_admin = true;

create index if not exists member_profiles_approval_status_idx
  on public.member_profiles (approval_status, created_at desc);

create index if not exists member_profiles_full_name_idx
  on public.member_profiles (lower(full_name));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.member_profiles (
    user_id,
    email,
    full_name,
    phone,
    is_admin,
    approval_status,
    church_status
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    false,
    'pending',
    'aguardando_aprovacao'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

drop policy if exists member_profiles_authenticated_select
  on public.member_profiles;

create policy member_profiles_authenticated_select
  on public.member_profiles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin()
  );

drop policy if exists member_profiles_admin_approval_update
  on public.member_profiles;

create policy member_profiles_admin_approval_update
  on public.member_profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke insert, update, delete, truncate, references, trigger
  on public.member_profiles
  from anon, authenticated;

grant select on public.member_profiles to authenticated;
grant update (
  approval_status,
  approved_at,
  approved_by,
  church_status,
  updated_at
) on public.member_profiles to authenticated;

comment on column public.member_profiles.approval_status is
  'pending: aguarda revisão; approved: acesso Família liberado; rejected: acesso bloqueado.';
