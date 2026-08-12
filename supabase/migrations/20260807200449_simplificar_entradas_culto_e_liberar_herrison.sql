alter table public.finance_service_income_records
  add column if not exists pix_cents bigint not null default 0 check (pix_cents >= 0);

update public.finance_service_income_records record
set pix_cents = totals.total_cents
from (
  select service_income_id, sum(amount_cents)::bigint as total_cents
  from public.finance_service_income_pix
  group by service_income_id
) totals
where totals.service_income_id = record.id
  and record.pix_cents = 0;

alter table public.finance_service_income_records
  alter column service_name set default 'Culto';

update public.member_profiles
set can_manage_finance = true
where user_id = 'b1f8e20a-e454-4505-8842-a8d423deb88b';

comment on column public.finance_service_income_records.pix_cents is
  'Valor total recebido por Pix na contagem do culto.';
