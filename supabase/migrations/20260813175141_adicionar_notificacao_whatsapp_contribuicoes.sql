alter table public.mercado_pago_payments
  add column whatsapp_notification_status text,
  add column whatsapp_notification_sent_at timestamptz,
  add column whatsapp_notification_message_id text,
  add column whatsapp_notification_error text;

update public.mercado_pago_payments
set whatsapp_notification_status = case
  when status = 'approved' then 'skipped'
  else 'pending'
end;

alter table public.mercado_pago_payments
  alter column whatsapp_notification_status set default 'pending',
  alter column whatsapp_notification_status set not null,
  add constraint mercado_pago_whatsapp_notification_status_check
    check (whatsapp_notification_status in ('pending', 'sending', 'sent', 'failed', 'skipped'));

create index mercado_pago_whatsapp_notification_pending_idx
  on public.mercado_pago_payments (updated_at)
  where whatsapp_notification_status in ('pending', 'failed');

comment on column public.mercado_pago_payments.whatsapp_notification_status is
  'Controla o envio idempotente da confirmação de contribuição ao WhatsApp exclusivo do Pastor Rilldy.';
