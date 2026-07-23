alter table public.member_profiles
  add column if not exists email text;

create or replace function public.handle_new_member_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member_profiles (
    user_id,
    email,
    full_name,
    church_role,
    ministries,
    profile_completed
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'visitante',
    '{}',
    false
  )
  on conflict (user_id) do update set
    email = excluded.email,
    full_name = case
      when coalesce(public.member_profiles.full_name, '') = '' then excluded.full_name
      else public.member_profiles.full_name
    end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_member_profile on auth.users;
create trigger on_auth_user_created_member_profile
after insert on auth.users
for each row execute procedure public.handle_new_member_profile();

insert into public.member_profiles (
  user_id,
  email,
  full_name,
  church_role,
  ministries,
  profile_completed
)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  'visitante',
  '{}',
  false
from auth.users u
on conflict (user_id) do update set
  email = excluded.email,
  full_name = case
    when coalesce(public.member_profiles.full_name, '') = '' then excluded.full_name
    else public.member_profiles.full_name
  end,
  updated_at = now();