create table public.event_ticket_deliveries (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.event_tickets(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  recipient text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_id, channel)
);

create index event_ticket_deliveries_status_idx
  on public.event_ticket_deliveries (status, updated_at desc);

alter table public.event_ticket_deliveries enable row level security;
revoke all on public.event_ticket_deliveries from anon, authenticated;
grant select, insert, update, delete on public.event_ticket_deliveries to service_role;

create or replace function public.claim_event_ticket_delivery(
  p_ticket_id uuid,
  p_channel text,
  p_recipient text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed_id uuid;
begin
  if p_channel not in ('email', 'whatsapp') or nullif(trim(p_recipient), '') is null then
    return null;
  end if;

  insert into public.event_ticket_deliveries (ticket_id, channel, recipient)
  values (p_ticket_id, p_channel, p_recipient)
  on conflict (ticket_id, channel) do nothing
  returning id into claimed_id;

  if claimed_id is null then
    update public.event_ticket_deliveries
    set recipient = p_recipient,
        status = 'sending',
        provider_message_id = null,
        error_message = null,
        updated_at = now()
    where ticket_id = p_ticket_id
      and channel = p_channel
      and (
        status = 'failed'
        or (status = 'sending' and updated_at < now() - interval '15 minutes')
      )
    returning id into claimed_id;
  end if;

  return claimed_id;
end;
$$;

revoke all on function public.claim_event_ticket_delivery(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_event_ticket_delivery(uuid, text, text) to service_role;

comment on table public.event_ticket_deliveries is
  'Auditoria e idempotencia da entrega automatica de ingressos digitais por e-mail e WhatsApp.';
