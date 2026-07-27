-- Perfil completo da Área da Família.
-- A estrela é calculada no banco e não pode ser concedida pelo navegador.

alter table public.member_profiles
  add column if not exists address text not null default '',
  add column if not exists church_since_month date,
  add column if not exists attended_other_church boolean,
  add column if not exists previous_church_name text not null default '',
  add column if not exists married boolean,
  add column if not exists spouse_name text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'member_profiles_address_length_check'
      and conrelid = 'public.member_profiles'::regclass
  ) then
    alter table public.member_profiles
      add constraint member_profiles_address_length_check
      check (
        address = ''
        or length(btrim(address)) between 8 and 500
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'member_profiles_church_since_month_check'
      and conrelid = 'public.member_profiles'::regclass
  ) then
    alter table public.member_profiles
      add constraint member_profiles_church_since_month_check
      check (
        church_since_month is null
        or (
          church_since_month = date_trunc('month', church_since_month)::date
          and church_since_month between date '1900-01-01' and date '2100-12-01'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'member_profiles_previous_church_check'
      and conrelid = 'public.member_profiles'::regclass
  ) then
    alter table public.member_profiles
      add constraint member_profiles_previous_church_check
      check (
        length(previous_church_name) <= 160
        and (
          (attended_other_church is null and previous_church_name = '')
          or (attended_other_church is false and previous_church_name = '')
          or (
            attended_other_church is true
            and length(btrim(previous_church_name)) between 2 and 160
          )
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'member_profiles_spouse_check'
      and conrelid = 'public.member_profiles'::regclass
  ) then
    alter table public.member_profiles
      add constraint member_profiles_spouse_check
      check (
        length(spouse_name) <= 160
        and (
          (married is null and spouse_name = '')
          or (married is false and spouse_name = '')
          or (
            married is true
            and length(btrim(spouse_name)) between 3 and 160
          )
        )
      );
  end if;
end
$$;

create or replace function public.set_member_profile_completion()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.profile_completed :=
    length(btrim(coalesce(new.full_name, ''))) between 3 and 160
    and length(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'))
      between 10 and 15
    and new.birth_date is not null
    and new.birth_date between date '1900-01-01' and current_date
    and length(btrim(coalesce(new.address, ''))) between 8 and 500
    and new.church_since_month is not null
    and new.church_since_month <= date_trunc('month', current_date)::date
    and new.jesus_year is not null
    and new.jesus_year between 1900 and extract(year from current_date)::integer
    and new.attended_other_church is not null
    and (
      new.attended_other_church is false
      or length(btrim(coalesce(new.previous_church_name, ''))) between 2 and 160
    )
    and new.baptized is not null
    and new.married is not null
    and (
      new.married is false
      or length(btrim(coalesce(new.spouse_name, ''))) between 3 and 160
    );

  new.updated_at := now();
  return new;
end;
$$;

revoke all
  on function public.set_member_profile_completion()
  from public, anon, authenticated;

drop trigger if exists set_member_profile_completion
  on public.member_profiles;

create trigger set_member_profile_completion
before insert or update of
  full_name,
  phone,
  birth_date,
  address,
  church_since_month,
  jesus_year,
  attended_other_church,
  previous_church_name,
  baptized,
  married,
  spouse_name
on public.member_profiles
for each row
execute function public.set_member_profile_completion();

update public.member_profiles
set profile_completed =
  length(btrim(coalesce(full_name, ''))) between 3 and 160
  and length(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'))
    between 10 and 15
  and birth_date is not null
  and birth_date between date '1900-01-01' and current_date
  and length(btrim(coalesce(address, ''))) between 8 and 500
  and church_since_month is not null
  and church_since_month <= date_trunc('month', current_date)::date
  and jesus_year is not null
  and jesus_year between 1900 and extract(year from current_date)::integer
  and attended_other_church is not null
  and (
    attended_other_church is false
    or length(btrim(coalesce(previous_church_name, ''))) between 2 and 160
  )
  and baptized is not null
  and married is not null
  and (
    married is false
    or length(btrim(coalesce(spouse_name, ''))) between 3 and 160
  );

drop policy if exists member_profiles_approved_self_update
  on public.member_profiles;

create policy member_profiles_approved_self_update
  on public.member_profiles
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and (approval_status = 'approved' or is_admin)
  )
  with check (
    user_id = (select auth.uid())
    and (approval_status = 'approved' or is_admin)
  );

grant update (
  full_name,
  phone,
  birth_date,
  address,
  church_since_month,
  jesus_year,
  attended_other_church,
  previous_church_name,
  baptized,
  married,
  spouse_name
) on public.member_profiles to authenticated;

comment on column public.member_profiles.church_since_month is
  'Primeiro dia do mês/ano em que a pessoa começou a frequentar a Casa Forte.';

comment on column public.member_profiles.profile_completed is
  'Calculado no banco. Quando verdadeiro, o membro conquistou a Estrela da Família.';
