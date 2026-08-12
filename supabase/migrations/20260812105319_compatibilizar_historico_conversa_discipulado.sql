-- Convites ainda pendentes passam imediatamente ao novo limite de duas opções.
delete from public.discipleship_invitation_options option_row
using public.discipleship_invitations invitation
where invitation.id = option_row.invitation_id
  and invitation.status = 'pending'
  and option_row.sort_order > 2;

-- Coloca os agendamentos ativos anteriores na conversa sem copiar anotações
-- privadas de acompanhamento.
insert into public.discipleship_conversation_messages (
  relationship_id,
  sender_id,
  message_type,
  invitation_id,
  scheduled_at,
  created_at
)
select
  invitation.relationship_id,
  case
    when invitation.status = 'accepted' then relationship.disciple_id
    else invitation.created_by
  end,
  case
    when invitation.status = 'accepted' then 'confirmation'
    else 'invitation'
  end,
  invitation.id,
  accepted_option.starts_at,
  coalesce(invitation.accepted_at, invitation.created_at)
from public.discipleship_invitations invitation
join public.discipleship_relationships relationship on relationship.id = invitation.relationship_id
left join public.discipleship_invitation_options accepted_option on accepted_option.id = invitation.accepted_option_id
where invitation.status in ('pending', 'accepted')
  and not exists (
    select 1 from public.discipleship_conversation_messages message
    where message.invitation_id = invitation.id
      and message.message_type in ('invitation', 'confirmation')
  );

insert into public.discipleship_conversation_messages (
  relationship_id,
  sender_id,
  message_type,
  created_at
)
select request.relationship_id, request.requested_by, 'request', request.created_at
from public.discipleship_scheduling_requests request
where request.status = 'pending'
  and not exists (
    select 1 from public.discipleship_conversation_messages message
    where message.relationship_id = request.relationship_id
      and message.message_type = 'request'
      and message.created_at = request.created_at
  );
