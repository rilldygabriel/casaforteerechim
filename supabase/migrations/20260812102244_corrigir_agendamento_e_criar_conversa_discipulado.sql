-- Limita convites a duas opções, evita duplicidade de WhatsApp por concorrência
-- e cria a conversa privada entre discipulador e discípulo.

alter table public.discipleship_invitation_options
  drop constraint if exists discipleship_invitation_options_sort_order_check;
alter table public.discipleship_invitation_options
  add constraint discipleship_invitation_options_sort_order_check
  check (sort_order between 1 and 2) not valid;

alter table public.discipleship_invitations
  add column if not exists invitation_type text not null default 'options'
  check (invitation_type in ('options', 'manual'));

create table public.discipleship_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.discipleship_relationships(id) on delete cascade,
  sender_id uuid not null references public.member_profiles(user_id) on delete restrict,
  message_type text not null default 'message'
    check (message_type in ('message', 'request', 'invitation', 'confirmation', 'manual_booking')),
  body text,
  invitation_id uuid references public.discipleship_invitations(id) on delete set null,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint discipleship_conversation_body_check check (
    (message_type = 'message' and length(btrim(coalesce(body, ''))) between 1 and 2000)
    or (message_type <> 'message' and body is null)
  )
);

create index discipleship_conversation_relationship_created_idx
  on public.discipleship_conversation_messages (relationship_id, created_at desc);
create index discipleship_conversation_sender_idx
  on public.discipleship_conversation_messages (sender_id);

alter table public.discipleship_conversation_messages enable row level security;

create policy discipleship_conversation_read_participants
  on public.discipleship_conversation_messages for select to authenticated
  using (exists (
    select 1 from public.discipleship_relationships r
    where r.id = relationship_id
      and r.ended_at is null
      and (r.discipler_id = (select auth.uid()) or r.disciple_id = (select auth.uid()))
  ));

create policy discipleship_conversation_insert_participants
  on public.discipleship_conversation_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and message_type = 'message'
    and exists (
      select 1 from public.discipleship_relationships r
      where r.id = relationship_id
        and r.ended_at is null
        and (r.discipler_id = (select auth.uid()) or r.disciple_id = (select auth.uid()))
    )
  );

grant select, insert on public.discipleship_conversation_messages to authenticated;

-- A inserção na tabela de auditoria funciona como uma reserva atômica. Se duas
-- execuções do cron chegarem juntas, somente uma recebe true e pode enviar.
create or replace function public.claim_discipleship_whatsapp_delivery(
  p_invitation_id uuid,
  p_recipient_id uuid,
  p_delivery_type text
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  claimed_id uuid;
begin
  insert into public.discipleship_whatsapp_deliveries (
    invitation_id, recipient_id, delivery_type, status, attempted_at
  ) values (
    p_invitation_id, p_recipient_id, p_delivery_type, 'pending', now()
  )
  on conflict (invitation_id, recipient_id, delivery_type) do nothing
  returning id into claimed_id;

  return claimed_id is not null;
end;
$$;

revoke all on function public.claim_discipleship_whatsapp_delivery(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_discipleship_whatsapp_delivery(uuid, uuid, text) to service_role;

comment on table public.discipleship_conversation_messages is
  'Conversa privada do vínculo; contém mensagens e eventos de agendamento, nunca observações pastorais.';
comment on function public.claim_discipleship_whatsapp_delivery(uuid, uuid, text) is
  'Reserva idempotente e atômica de uma entrega WhatsApp antes do envio ao provedor.';
