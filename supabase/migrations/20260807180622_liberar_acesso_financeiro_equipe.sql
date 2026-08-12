alter table public.member_profiles
  add column if not exists can_manage_finance boolean not null default false;

update public.member_profiles
set can_manage_finance = true
where user_id in (
  '2d96b244-4d1d-4797-950b-0ba93ed62cfc',
  '457e20f6-69fe-4201-9f24-cd2947e456db',
  '4233f7fd-d931-445d-afab-d775d221a68e'
);

create index if not exists member_profiles_finance_access_idx
  on public.member_profiles (user_id)
  where can_manage_finance = true;

comment on column public.member_profiles.can_manage_finance is
  'Permite acessar e operar somente o módulo financeiro, sem conceder administração geral.';
