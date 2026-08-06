alter table public.member_profiles
  add column if not exists gender text;

alter table public.member_applications
  add column if not exists gender text;

alter table public.member_profiles
  drop constraint if exists member_profiles_gender_check;

alter table public.member_profiles
  add constraint member_profiles_gender_check
  check (gender is null or gender in ('masculino', 'feminino'));

alter table public.member_applications
  drop constraint if exists member_applications_gender_check;

alter table public.member_applications
  add constraint member_applications_gender_check
  check (gender is null or gender in ('masculino', 'feminino'));

comment on column public.member_profiles.gender is
  'Sexo informado no cadastro: masculino ou feminino.';

comment on column public.member_applications.gender is
  'Sexo informado na solicitação de cadastro: masculino ou feminino.';
