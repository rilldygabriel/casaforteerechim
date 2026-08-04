alter table public.member_profiles
  add column if not exists has_discipler boolean,
  add column if not exists serves_ministry boolean;

create table public.ministry_membership_requests (
  member_id uuid not null references public.member_profiles(user_id) on delete cascade,
  ministry_key text not null references public.ministries(key) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.member_profiles(user_id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (member_id, ministry_key)
);

create table public.discipleship_requests (
  member_id uuid primary key references public.member_profiles(user_id) on delete cascade,
  discipler_id uuid not null references public.discipler_roles(member_id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.member_profiles(user_id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (member_id <> discipler_id)
);

create index ministry_membership_requests_status_idx on public.ministry_membership_requests (status, created_at);
create index discipleship_requests_status_idx on public.discipleship_requests (status, created_at);

alter table public.ministry_membership_requests enable row level security;
alter table public.discipleship_requests enable row level security;

create policy ministry_requests_read on public.ministry_membership_requests for select to authenticated
using (member_id = (select auth.uid()) or (select public.is_admin()));
create policy ministry_requests_insert on public.ministry_membership_requests for insert to authenticated
with check (member_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and reviewed_at is null);
create policy ministry_requests_member_delete on public.ministry_membership_requests for delete to authenticated
using (member_id = (select auth.uid()) and status <> 'approved');
create policy ministry_requests_admin_update on public.ministry_membership_requests for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy discipleship_requests_read on public.discipleship_requests for select to authenticated
using (member_id = (select auth.uid()) or (select public.is_admin()));
create policy discipleship_requests_insert on public.discipleship_requests for insert to authenticated
with check (member_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and reviewed_at is null);
create policy discipleship_requests_member_delete on public.discipleship_requests for delete to authenticated
using (member_id = (select auth.uid()) and status <> 'approved');
create policy discipleship_requests_admin_update on public.discipleship_requests for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.ministry_membership_requests, public.discipleship_requests from anon, authenticated;
grant select, insert, delete on public.ministry_membership_requests, public.discipleship_requests to authenticated;
grant update on public.ministry_membership_requests, public.discipleship_requests to authenticated;

create or replace function public.set_member_profile_completion()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  new.profile_completed :=
    length(btrim(coalesce(new.full_name, ''))) between 3 and 160
    and length(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g')) between 10 and 15
    and new.birth_date is not null and new.birth_date between date '1900-01-01' and current_date
    and length(btrim(coalesce(new.address, ''))) between 8 and 500
    and new.church_since_month is not null and new.church_since_month <= date_trunc('month', current_date)::date
    and new.jesus_year is not null and new.jesus_year between 1900 and extract(year from current_date)::integer
    and new.attended_other_church is not null
    and (new.attended_other_church is false or length(btrim(coalesce(new.previous_church_name, ''))) between 2 and 160)
    and new.baptized is not null
    and new.married is not null
    and (new.married is false or length(btrim(coalesce(new.spouse_name, ''))) between 3 and 160)
    and new.has_discipler is not null
    and new.serves_ministry is not null;
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists set_member_profile_completion on public.member_profiles;
create trigger set_member_profile_completion before insert or update of
  full_name, phone, birth_date, address, church_since_month, jesus_year,
  attended_other_church, previous_church_name, baptized, married, spouse_name,
  has_discipler, serves_ministry
on public.member_profiles for each row execute function public.set_member_profile_completion();

update public.member_profiles set has_discipler = null, serves_ministry = null;

comment on table public.ministry_membership_requests is 'Ministérios informados pelo membro e aguardando aceite administrativo.';
comment on table public.discipleship_requests is 'Discipulador informado pelo membro e aguardando aceite administrativo.';
