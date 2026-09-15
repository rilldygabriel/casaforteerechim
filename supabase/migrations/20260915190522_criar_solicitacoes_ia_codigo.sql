create table if not exists public.site_ai_change_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  conversation_id bigint not null,
  origin_message_id text not null unique,
  business_phone_number_id text not null,
  request_text text not null check (char_length(request_text) between 5 and 4000),
  status text not null default 'queued' check (status in ('queued','running','awaiting_confirmation','confirmed','merging','published','failed','cancelled','expired')),
  branch_name text,
  pull_request_number integer,
  pull_request_url text,
  pull_request_head_sha text,
  merge_commit_sha text,
  preview_url text,
  summary text,
  confirmation_code text unique,
  confirmation_expires_at timestamptz,
  deployment_id text,
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_ai_change_requests_status_created_idx
  on public.site_ai_change_requests (status, created_at);

alter table public.site_ai_change_requests enable row level security;
revoke all on public.site_ai_change_requests from anon, authenticated;
grant all on public.site_ai_change_requests to service_role;

create table if not exists public.site_ai_executor_monthly_budget (
  billing_month date primary key,
  reserved_runs integer not null default 0 check (reserved_runs between 0 and 8),
  updated_at timestamptz not null default now()
);
alter table public.site_ai_executor_monthly_budget enable row level security;
revoke all on public.site_ai_executor_monthly_budget from anon, authenticated;
grant select, insert, update on public.site_ai_executor_monthly_budget to service_role;

create or replace function public.queue_site_ai_code_request(
  p_owner_user_id uuid,
  p_conversation_id bigint,
  p_origin_message_id text,
  p_business_phone_number_id text,
  p_request_text text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_count integer;
begin
  insert into public.site_ai_change_requests
    (owner_user_id, conversation_id, origin_message_id, business_phone_number_id, request_text)
  values (p_owner_user_id, p_conversation_id, p_origin_message_id,
          p_business_phone_number_id, p_request_text)
  on conflict (origin_message_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.site_ai_change_requests
      where origin_message_id = p_origin_message_id;
    return v_id;
  end if;

  insert into public.site_ai_executor_monthly_budget (billing_month, reserved_runs)
  values (v_month, 1)
  on conflict (billing_month) do update
    set reserved_runs = public.site_ai_executor_monthly_budget.reserved_runs + 1,
        updated_at = now()
    where public.site_ai_executor_monthly_budget.reserved_runs < 8
  returning reserved_runs into v_count;
  if v_count is null then
    raise exception 'monthly_executor_budget_exhausted';
  end if;
  return v_id;
end;
$$;
revoke all on function public.queue_site_ai_code_request(uuid,bigint,text,text,text) from public, anon, authenticated;
grant execute on function public.queue_site_ai_code_request(uuid,bigint,text,text,text) to service_role;

comment on table public.site_ai_change_requests is
  'Pedidos de alteracao de codigo recebidos apenas do WhatsApp autorizado; sem acesso publico ou de membros.';
