-- Recalcula apenas etapas pendentes; contatos já concluídos mantêm o histórico.
update public.visitor_followup_steps as followup
set due_date = visitor.data_visita + case
    when extract(dow from visitor.data_visita)::integer = 3 then case followup.step_key
      when 'monday_message' then 1 when 'thursday_message' then 4
      when 'next_service_invite' then 7 when 'following_week_contact' then 10 end
    else case followup.step_key
      when 'monday_message' then 1 when 'thursday_message' then 4
      when 'next_service_invite' then 6 when 'following_week_contact' then 10 end
  end,
  updated_at = now()
from public.visitantes as visitor
where visitor.id = followup.visitor_id and followup.completed_at is null;
