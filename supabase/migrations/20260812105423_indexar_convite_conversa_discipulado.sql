create index discipleship_conversation_invitation_idx
  on public.discipleship_conversation_messages (invitation_id)
  where invitation_id is not null;
